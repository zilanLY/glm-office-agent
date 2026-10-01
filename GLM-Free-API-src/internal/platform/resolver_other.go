//go:build !android

// Package platform is a no-op off-Android: desktop and server builds
// read /etc/resolv.conf (or the OS resolver) normally, so the pure-Go
// DNS fallback never kicks in. The blank import in main.go exists only
// so the android build tag variant compiles into android binaries.
package platform
