// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import viteReact from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { createRequire } from "node:module";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const require = createRequire(import.meta.url);
  const hasRollbarReplay = (() => {
    try {
      require.resolve("rollbar/replay");
      return true;
    } catch {
      return false;
    }
  })();

  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");
  const toSafeChunk = (name: string) =>
    name.replace(/^@/, "at-").replace(/[\\/]/g, "-");
  const noStandaloneVendorChunk = new Set([
    "@swc/helpers",
    "jsesc",
    "tabbable",
  ]);

  const getPackageName = (id: string) => {
    const normalizedPath = id.replace(/\\/g, "/");
    const match = normalizedPath.match(
      /node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/,
    );
    return match ? match[1] : null;
  };

  return {
    plugins: [
      TanStackRouterVite({
        routeFileIgnorePattern: "[.]test[.]",
      }),
      viteReact({
        babel: {
          plugins: [["babel-plugin-react-compiler"]],
        },
      }),
      tailwindcss(),
    ],

    // Development server configuration
    server: {
      port: env.PORT ? parseInt(env.PORT, 10) : 5173,
      // OneDrive's "Files On-Demand" turns some files into reparse points
      // that node's fs.readlink can't read; Vite's HMR watcher then crashes
      // with EINVAL. Excluding e2e/ and dist/ from the watcher avoids this
      // without affecting the app dev experience.
      watch: {
        ignored: ["**/e2e/**", "**/dist/**", "**/.git/**", "**/coverage/**"],
      },
    },

    // Production build configuration
    build: {
      sourcemap: true, // Enable source maps for Rollbar debugging
      minify: "terser",
      terserOptions: {
        sourceMap: true, // Preserve source maps in minified output
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            const normalizedPath = id.replace(/\\/g, "/");

            if (id.includes("node_modules")) {
              const packageName = getPackageName(normalizedPath);

              if (!packageName) {
                return "vendor";
              }

              if (noStandaloneVendorChunk.has(packageName)) {
                // Let Rollup merge tiny helper deps into importer chunks.
                // Avoids noisy empty chunk warnings for tree-shaken packages.
                return undefined;
              }

              if (packageName.startsWith("@tanstack")) return "vendor-tanstack";
              if (packageName.startsWith("@radix-ui")) return "vendor-radix";
              if (packageName.startsWith("@hookform")) return "vendor-hookform";
              if (packageName.startsWith("@reduxjs")) return "vendor-redux";
              if (packageName.startsWith("react-router"))
                return "vendor-router";
              if (
                packageName === "react" ||
                packageName === "react-dom" ||
                packageName === "scheduler"
              ) {
                return "vendor-react";
              }
              if (packageName === "framer-motion") return "vendor-motion";
              if (packageName === "recharts") return "vendor-charts";

              return `vendor-${toSafeChunk(packageName)}`;
            }

            const match = normalizedPath.match(/src\/routes\/([^/]+)\.tsx$/);
            if (!match) return undefined;

            const routeFile = match[1];

            if (routeFile.startsWith("admin.")) return "route-admin";
            if (
              /^(index|verify-email|forgot-password|signup|checkout|settings|logged|scannedQR)\./.test(
                routeFile,
              )
            )
              return "route-auth";
            if (
              /^(projects|project\.|my-qrcodes|group\.|groups|qrcode\.)/.test(
                routeFile,
              )
            ) {
              if (/^(projects|project\.)/.test(routeFile)) {
                return "route-management-projects";
              }
              if (/^(groups|group\.)/.test(routeFile)) {
                return "route-management-groups";
              }
              return "route-management";
            }
            if (routeFile.includes("qr")) return "route-qr";

            return "route-core";
          },
        },
      },
    },

    assetsInclude: [
      "**/*.docx",
      "**/*.mp4",
      "**/*.mov",
      "**/*.zip",
      "**/*.xlsx",
      "**/*.csv",
    ],

    resolve: {
      alias: [
        // @rollbar/react imports bare 'rollbar' which calls setComponents()
        // on the shared prototype WITHOUT replay, overwriting rollbar/replay's
        // setup. Alias bare 'rollbar' → 'rollbar/replay' so every consumer
        // uses the replay-enabled build.
        ...(hasRollbarReplay
          ? [{ find: /^rollbar$/, replacement: "rollbar/replay" }]
          : []),
        { find: "@api", replacement: "/src/api" },
        { find: "@assets", replacement: "/src/assets" },
        { find: "@components", replacement: "/src/components" },
        { find: "@pages", replacement: "/src/pages" },
        { find: "@lib", replacement: "/src/lib" },
        { find: "@data", replacement: "/src/api/mockdata" },
        { find: "@types", replacement: "/src/types" },
        { find: "@", replacement: "/src" },
      ],
    },
  };
});
