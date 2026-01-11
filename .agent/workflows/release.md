---
description: Release Workflow
---
# Release Workflow

This workflow describes how to release a new version of the Weekly Food Menu application.

## Steps

1.  **Test Responsive Layouts**: Verify layout at 375px, 600px, 768px, 1024px viewports
2.  **Verify Changes**: Ensure all changes are committed or ready to be committed.
3.  **Run Release Script**:
    ```bash
    npm run release
    ```
    This command will:
    - Increment the patch version in `package.json`.
    - Update the version constant in `js/version.js`.
    
4.  **Commit Version Bump**:
    ```bash
    git add package.json js/version.js
    git commit -m "chore: release v<new-version>"
    ```

5.  **Push**:
    ```bash
    git push origin <branch>
    ```

// turbo-all
