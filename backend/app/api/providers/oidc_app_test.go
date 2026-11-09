package providers

import (
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/sysadminsmedia/homebox/backend/internal/core/services"
	"github.com/sysadminsmedia/homebox/backend/internal/sys/config"
)

func testProvider(redirectURIs string) *OIDCProvider {
	return &OIDCProvider{
		config:   &config.OIDCConf{AppRedirectURIs: redirectURIs, StateExpiry: time.Minute},
		handoffs: newAppHandoffStore(),
	}
}

func TestParseAppHandoff(t *testing.T) {
	p := testProvider("homecrate://auth/callback, other://cb")
	challenge := generatePKCEChallenge("verifier-verifier-verifier-verifier-verifier")

	cases := []struct {
		name    string
		query   url.Values
		want    *AppHandoff
		wantErr error
	}{
		{name: "browser sign-in", query: url.Values{}},
		{
			name:  "allowed app",
			query: url.Values{"redirect_uri": {"homecrate://auth/callback"}, "code_challenge": {challenge}, "code_challenge_method": {"S256"}},
			want:  &AppHandoff{RedirectURI: "homecrate://auth/callback", Challenge: challenge},
		},
		{
			name:    "unlisted redirect",
			query:   url.Values{"redirect_uri": {"evil://cb"}, "code_challenge": {challenge}},
			wantErr: ErrAppRedirectNotAllowed,
		},
		{
			name:    "missing challenge",
			query:   url.Values{"redirect_uri": {"other://cb"}},
			wantErr: ErrAppChallengeInvalid,
		},
		{
			name:    "plain method",
			query:   url.Values{"redirect_uri": {"other://cb"}, "code_challenge": {challenge}, "code_challenge_method": {"plain"}},
			wantErr: ErrAppChallengeInvalid,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/api/v1/users/login/oidc?"+tc.query.Encode(), nil)
			got, err := p.parseAppHandoff(r)
			if tc.wantErr != nil {
				assert.ErrorIs(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestParseAppHandoffDisabled(t *testing.T) {
	p := testProvider("")
	r := httptest.NewRequest("GET", "/?redirect_uri=homecrate://auth/callback&code_challenge=x", nil)
	_, err := p.parseAppHandoff(r)
	assert.ErrorIs(t, err, ErrAppRedirectNotAllowed)
}

func TestAppHandoffCookieRoundTrip(t *testing.T) {
	p := testProvider("homecrate://auth/callback")
	h := &AppHandoff{RedirectURI: "homecrate://auth/callback", Challenge: generatePKCEChallenge("v")}

	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/", nil)
	p.setAppHandoffCookies(w, r, "localhost", h)

	callback := httptest.NewRequest("GET", "/callback", nil)
	for _, c := range w.Result().Cookies() {
		callback.AddCookie(c)
	}
	assert.Equal(t, h, p.AppHandoffFromCallback(callback))

	// Removing the URI from the allow list rejects flows already in progress.
	p.config.AppRedirectURIs = ""
	assert.Nil(t, p.AppHandoffFromCallback(callback))
}

func TestAppHandoffExchange(t *testing.T) {
	p := testProvider("homecrate://auth/callback")
	verifier := "a-long-random-verifier-string-from-the-app-123"
	token := services.UserAuthTokenDetail{Raw: "session-token", ExpiresAt: time.Now().Add(time.Hour)}

	code, err := p.CreateAppHandoff(token, generatePKCEChallenge(verifier))
	require.NoError(t, err)

	// Wrong verifier fails and burns the code.
	_, err = p.ExchangeAppHandoff(code, "wrong")
	require.ErrorIs(t, err, ErrHandoffInvalid)
	_, err = p.ExchangeAppHandoff(code, verifier)
	require.ErrorIs(t, err, ErrHandoffInvalid)

	code, err = p.CreateAppHandoff(token, generatePKCEChallenge(verifier))
	require.NoError(t, err)
	got, err := p.ExchangeAppHandoff(code, verifier)
	require.NoError(t, err)
	assert.Equal(t, token.Raw, got.Raw)

	// Single use.
	_, err = p.ExchangeAppHandoff(code, verifier)
	require.ErrorIs(t, err, ErrHandoffInvalid)
}

func TestAppHandoffExpiry(t *testing.T) {
	p := testProvider("homecrate://auth/callback")
	code, err := p.CreateAppHandoff(services.UserAuthTokenDetail{Raw: "t"}, generatePKCEChallenge("v"))
	require.NoError(t, err)

	p.handoffs.mu.Lock()
	e := p.handoffs.entries[code]
	e.expiresAt = time.Now().Add(-time.Second)
	p.handoffs.entries[code] = e
	p.handoffs.mu.Unlock()

	_, err = p.ExchangeAppHandoff(code, "v")
	assert.ErrorIs(t, err, ErrHandoffInvalid)
}

func TestAppRedirectURL(t *testing.T) {
	assert.Equal(t, "homecrate://auth/callback?code=abc", AppRedirectURL("homecrate://auth/callback", map[string]string{"code": "abc"}))
	assert.Equal(t, "homecrate://auth/callback?error=oidc_auth_failed&x=1", AppRedirectURL("homecrate://auth/callback?x=1", map[string]string{"error": "oidc_auth_failed"}))
}
