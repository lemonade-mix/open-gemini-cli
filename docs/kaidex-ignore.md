# Ignoring Files

This document provides an overview of the KaiDex Ignore (`.kaidexignore`) feature of the KaiDex CLI.

The KaiDex CLI includes the ability to automatically ignore files, similar to `.gitignore` (used by Git) and `.aiexclude` (used by KaiDex Code Assist). Adding paths to your `.kaidexignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.kaidexignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](./tools/multi-file.md) command, any paths in your `.kaidexignore` file will be automatically excluded.

For the most part, `.kaidexignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.kaidexignore` file.
- `!` negates a pattern.

You can update your `.kaidexignore` file at any time. To apply the changes, you must restart your KaiDex CLI session.

## How to use `.kaidexignore`

To enable `.kaidexignore`:

1. Create a file named `.kaidexignore` in the root of your project directory.

To add a file or directory to `.kaidexignore`:

1. Open your `.kaidexignore` file.
2. Add the path or file you want to ignore, for example: `/archive/` or `apikeys.txt`.

### `.kaidexignore` examples

You can use `.kaidexignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.kaidexignore` file with `*`:

```
# Exclude all .md files
*.md
```

Finally, you can exclude files and directories from exclusion with `!`:

```
# Exclude all .md files except README.md
*.md
!README.md
```

To remove paths from your `.kaidexignore` file, delete the relevant lines.
