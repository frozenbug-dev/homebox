const { withPodfile } = require('expo/config-plugins')

/**
 * react-native-nitro-web-image imports SDWebImage from Swift, which needs the
 * pod's modular headers; SDWebImage doesn't enable them for static linkage.
 */
module.exports = function withSDWebImageModularHeaders(config) {
  return withPodfile(config, (cfg) => {
    const line = "  pod 'SDWebImage', :modular_headers => true"
    if (!cfg.modResults.contents.includes(line)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(/(target '[^']+' do\n)/, `$1${line}\n`)
    }
    return cfg
  })
}
