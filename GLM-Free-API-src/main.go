// GLM Bridge — Z.AI Proxy API.
//
// Thin entry point: the whole bridge lives in internal/zbridge (see README
// "Project Structure"), mirroring the DeepseekFreeAPI layout this project
// follows. Token collection is a separate binary under cmd/token-collector.
//
// Build:  go build -trimpath -ldflags="-s -w" -gcflags="all=-l=4" -o zai-api .
// Run:    ./zai-api            (or: go run .)

package main

import (
	// Blank import: installs the Android DNS resolver patch (no
	// /etc/resolv.conf on Android breaks CGO_ENABLED=0 builds). No-op
	// on other platforms. See internal/platform.
	_ "zai-api/internal/platform"

	"zai-api/internal/zbridge"
)

func main() {
    zbridge.Run()
}
