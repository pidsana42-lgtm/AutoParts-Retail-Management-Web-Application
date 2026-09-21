// Package secret provides a single fail-fast way to read required secrets from
// the environment. It intentionally has no internal dependencies (stdlib only)
// so any package — including low-level ones like crypto — can import it safely.
package secret

import (
	"log"
	"os"
)

// Required reads an environment variable and stops the program immediately if
// it is unset or empty, instead of silently continuing with an insecure
// hardcoded default that is visible to anyone reading this repository's source
// (e.g. on GitHub) — which would let them forge JWTs or decrypt stored data.
func Required(envVar string) string {
	v := os.Getenv(envVar)
	if v == "" {
		log.Fatalf(
			"%s is not set. Refusing to start with an insecure hardcoded default secret — set %s in your .env file.",
			envVar, envVar,
		)
	}
	return v
}
