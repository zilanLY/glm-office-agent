//go:build android

// Package platform carries platform-specific compatibility patches that
// must be side-effect loaded via a blank import (see main.go).
//
// Android ships no /etc/resolv.conf, and a CGO_ENABLED=0 build uses the
// pure-Go resolver, which falls back to probing 127.0.0.1:53 when it
// cannot read the system configuration — so EVERY outbound lookup fails
// and the bridge cannot reach chat.z.ai at all on a real device.
//
// Fix: install a net.DefaultResolver that dials an explicit,
// round-robin list of public DNS servers instead of the unusable system
// configuration. Operators can override the list with ZAI_DNS_SERVERS
// (comma-separated entries, optional :port, e.g. "223.5.5.5,1.1.1.1").
package platform

import (
	"context"
	"fmt"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

var defaultAndroidDNSServers = []string{
	"223.5.5.5:53",    // AliDNS
	"119.29.29.29:53", // DNSPod (Tencent)
	"1.2.4.8:53",      // CNNIC sdns
	"8.8.8.8:53",      // Google (fallback for proxy/VPN setups)
}

func init() {
	servers := resolveServers()
	var dialer net.Dialer
	var next uint32
	net.DefaultResolver = &net.Resolver{
		PreferGo: true,
		Dial: func(ctx context.Context, network, _ string) (net.Conn, error) {
			// The address passed by the Go resolver is the unusable
			// system configuration (e.g. 127.0.0.1:53) — ignore it and
			// rotate through the explicit server list instead.
			i := atomic.AddUint32(&next, 1)
			server := servers[int(i)%len(servers)]
			dctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
			return dialer.DialContext(dctx, "udp", server)
		},
	}
	fmt.Printf("[platform] android DNS resolver active, servers=%s (override with ZAI_DNS_SERVERS)\n",
		strings.Join(servers, ","))
}

func resolveServers() []string {
	raw := strings.TrimSpace(os.Getenv("ZAI_DNS_SERVERS"))
	if raw == "" {
		return defaultAndroidDNSServers
	}
	var out []string
	for _, s := range strings.Split(raw, ",") {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, _, err := net.SplitHostPort(s); err != nil {
			s = s + ":53"
		}
		out = append(out, s)
	}
	if len(out) == 0 {
		return defaultAndroidDNSServers
	}
	return out
}
