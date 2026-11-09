package providers

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
)

// Native app sign-in ("app handoff")
//
// The browser OIDC flow ends with session cookies set on the server's domain,
// which a native app can't read: it runs the flow in the system browser
// (Custom Tabs / ASWebAuthenticationSession), not in its own cookie jar. So
// when the app starts the flow it also passes:
//
//   - redirect_uri:   where to send the browser once sign-in finishes; must be
//     listed in HBOX_OIDC_APP_REDIRECT_URIS (e.g. homecrate://auth/callback)
//   - code_challenge: base64url(SHA-256(verifier)) of a secret only the app knows
//
// After the normal callback succeeds, the server doesn't set cookies. It mints
// a short-lived, single-use handoff code, keeps the session token next to it
// in memory and redirects the browser to redirect_uri?code=…. The app then
// POSTs the code and its verifier to /users/login/oidc/exchange to get the
// token. Another app that registered the same URL scheme could catch the
// redirect, but without the verifier the code is useless (RFC 7636).

const (
	cookieAppRedirect  = "oidc_app_redirect"
	cookieAppChallenge = "oidc_app_challenge"

	// appHandoffTTL bounds how long a handoff code can be exchanged. The app
	// exchanges it right after the browser returns, so this can be short.
	appHandoffTTL = 2 * time.Minute
)

var (
	ErrAppRedirectNotAllowed = errors.New("redirect_uri is not an allowed app redirect URI")
	ErrAppChallengeInvalid   = errors.New("code_challenge must be a base64url SHA-256 digest")
	ErrHandoffInvalid        = errors.New("handoff code is invalid, expired or already used")
)

// AppHandoff is the native app sign-in request carried through the OIDC flow.
type AppHandoff struct {
	RedirectURI string
	Challenge   string
}

type appHandoffEntry struct {
	token     services.UserAuthTokenDetail
	challenge string
	expiresAt time.Time
}

// appHandoffStore holds handoff codes in memory. Codes live for minutes and are
// single-use, so losing them on restart only means the user signs in again.
// Deployments running several replicas behind a load balancer need sticky
// sessions for the exchange call to reach the replica that minted the code.
type appHandoffStore struct {
	mu      sync.Mutex
	entries map[string]appHandoffEntry
}

func newAppHandoffStore() *appHandoffStore {
	return &appHandoffStore{entries: map[string]appHandoffEntry{}}
}

func (s *appHandoffStore) put(token services.UserAuthTokenDetail, challenge string) (string, error) {
	code, err := generateSecureToken()
	if err != nil {
		return "", err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	for k, e := range s.entries {
		if now.After(e.expiresAt) {
			delete(s.entries, k)
		}
	}

	s.entries[code] = appHandoffEntry{token: token, challenge: challenge, expiresAt: now.Add(appHandoffTTL)}
	return code, nil
}

// take removes the code (even when the verifier is wrong, so a code can't be
// brute-forced) and returns its token if the verifier matches.
func (s *appHandoffStore) take(code, verifier string) (services.UserAuthTokenDetail, error) {
	s.mu.Lock()
	entry, ok := s.entries[code]
	delete(s.entries, code)
	s.mu.Unlock()

	if !ok || time.Now().After(entry.expiresAt) || verifier == "" {
		return services.UserAuthTokenDetail{}, ErrHandoffInvalid
	}

	got := generatePKCEChallenge(verifier)
	if subtle.ConstantTimeCompare([]byte(got), []byte(entry.challenge)) != 1 {
		return services.UserAuthTokenDetail{}, ErrHandoffInvalid
	}

	return entry.token, nil
}

// AppRedirectURIs returns the configured native app redirect URIs.
func (p *OIDCProvider) AppRedirectURIs() []string {
	return ParseAppRedirectURIs(p.config.AppRedirectURIs)
}

// ParseAppRedirectURIs splits the comma separated HBOX_OIDC_APP_REDIRECT_URIS value.
func ParseAppRedirectURIs(raw string) []string {
	var uris []string
	for _, part := range strings.Split(raw, ",") {
		if part = strings.TrimSpace(part); part != "" {
			uris = append(uris, part)
		}
	}
	return uris
}

// parseAppHandoff reads the optional app sign-in parameters from the request
// that starts the flow. It returns nil when the request is a browser sign-in.
func (p *OIDCProvider) parseAppHandoff(r *http.Request) (*AppHandoff, error) {
	q := r.URL.Query()
	redirectURI := q.Get("redirect_uri")
	challenge := q.Get("code_challenge")

	if redirectURI == "" && challenge == "" {
		return nil, nil
	}

	allowed := false
	for _, uri := range p.AppRedirectURIs() {
		if uri == redirectURI {
			allowed = true
			break
		}
	}
	if !allowed {
		return nil, ErrAppRedirectNotAllowed
	}

	if method := q.Get("code_challenge_method"); method != "" && method != "S256" {
		return nil, ErrAppChallengeInvalid
	}
	if decoded, err := base64.RawURLEncoding.DecodeString(challenge); err != nil || len(decoded) != sha256.Size {
		return nil, ErrAppChallengeInvalid
	}

	return &AppHandoff{RedirectURI: redirectURI, Challenge: challenge}, nil
}

func (p *OIDCProvider) setAppHandoffCookies(w http.ResponseWriter, r *http.Request, domain string, h *AppHandoff) {
	for name, value := range map[string]string{cookieAppRedirect: h.RedirectURI, cookieAppChallenge: h.Challenge} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    url.QueryEscape(value),
			Expires:  time.Now().Add(p.config.StateExpiry),
			Domain:   domain,
			Secure:   p.isSecure(r),
			HttpOnly: true,
			Path:     "/",
			SameSite: http.SameSiteLaxMode,
		})
	}
}

func (p *OIDCProvider) clearAppHandoffCookies(w http.ResponseWriter, r *http.Request, domain string) {
	for _, name := range []string{cookieAppRedirect, cookieAppChallenge} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Expires:  time.Unix(0, 0),
			Domain:   domain,
			MaxAge:   -1,
			Secure:   p.isSecure(r),
			HttpOnly: true,
			Path:     "/",
			SameSite: http.SameSiteLaxMode,
		})
	}
}

// AppHandoffFromCallback returns the app sign-in request started earlier in
// this browser, if any. The redirect URI is checked against the allow list
// again so a changed config takes effect for flows already in progress.
func (p *OIDCProvider) AppHandoffFromCallback(r *http.Request) *AppHandoff {
	redirectCookie, err := r.Cookie(cookieAppRedirect)
	if err != nil {
		return nil
	}
	challengeCookie, err := r.Cookie(cookieAppChallenge)
	if err != nil {
		return nil
	}

	redirectURI, err := url.QueryUnescape(redirectCookie.Value)
	if err != nil {
		return nil
	}
	challenge, err := url.QueryUnescape(challengeCookie.Value)
	if err != nil {
		return nil
	}

	for _, uri := range p.AppRedirectURIs() {
		if uri == redirectURI {
			return &AppHandoff{RedirectURI: redirectURI, Challenge: challenge}
		}
	}
	return nil
}

// AppRedirectURL builds the URL the browser is sent to at the end of an app
// sign-in, carrying either the handoff code or an error.
func AppRedirectURL(redirectURI string, params map[string]string) string {
	u, err := url.Parse(redirectURI)
	if err != nil {
		return redirectURI
	}
	q := u.Query()
	for k, v := range params {
		q.Set(k, v)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// CreateAppHandoff stores the session token and returns a single-use code for it.
func (p *OIDCProvider) CreateAppHandoff(token services.UserAuthTokenDetail, challenge string) (string, error) {
	return p.handoffs.put(token, challenge)
}

// ExchangeAppHandoff trades a handoff code and its PKCE verifier for the session token.
func (p *OIDCProvider) ExchangeAppHandoff(code, verifier string) (services.UserAuthTokenDetail, error) {
	return p.handoffs.take(code, verifier)
}
