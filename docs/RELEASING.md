# Publishing fletch-sdk

`fletch-sdk` is prepared at version `0.3.2`. The npm registry returned 404 for
this package on 15 September 2026; publication remains pending. The repository
root and webhook verifier are private npm workspaces. Publish only the SDK.

## Check the package

From the repository root, use Node 22.18 or later:

```bash
npm ci --ignore-scripts
npm run generate
git diff --exit-code -- packages/fletch-sdk/src/generated
npm run typecheck
npm run test:offline
npm run test:package
npm pack --workspace fletch-sdk
```

`test:package` builds a tarball, installs it in a temporary application without
network access, checks the license and public files, imports the client and
compiles a consumer against the shipped declarations. It removes the temporary
application when finished. `npm pack` leaves `fletch-sdk-0.3.2.tgz` for release.

Keep the package version and lockfile in step. Commit the source, generated types
and release documentation before publishing. The generated-type check compares
against that commit; review and commit an intentional schema update first.

## Publish

The manual `publish SDK` workflow accepts the package version and runs only from
`main`. It validates the source, checks an installed package and uploads the
release tarball before publishing. The workflow needs a repository secret named
`NPM_TOKEN` with permission to publish `fletch-sdk`; a missing or rejected token
fails the publication step. Repository code does not contain that credential.

For a local release, authenticate with an npm account that can publish the name,
then publish the checked tarball:

```bash
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish ./fletch-sdk-0.3.2.tgz --access public --ignore-scripts --registry=https://registry.npmjs.org
npm view fletch-sdk@0.3.2 version dist.integrity --registry=https://registry.npmjs.org
```

The workflow requests a provenance statement, which records the source and build
identity. See [npm's provenance documentation](https://docs.npmjs.com/generating-provenance-statements/).
Local publishing does not produce that workflow attestation.

After npm confirms the version, install `fletch-sdk@0.3.2` in a fresh application
and repeat the runtime and declaration checks. Then replace the pending-release
instructions in both READMEs with `npm install fletch-sdk@0.3.2`. A successful
build or uploaded tarball does not establish that the npm release exists.
