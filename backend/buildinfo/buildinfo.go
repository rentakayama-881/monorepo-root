package buildinfo

// Version is set at build time (CI/CD) using:
//
//	-ldflags "-X backend-gin/buildinfo.Version=<git-sha>"
//
// It is exposed via the health endpoint to verify what commit is running.
var Version = "dev"
