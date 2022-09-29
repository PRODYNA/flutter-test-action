# flutter-test-action

This action runs `flutter test` and attaches a [check run](https://docs.github.com/en/rest/checks/runs) to the current commit.

## Usage

```yaml
jobs:
  test:
    name: Test Runner
    steps:
    - name: Checkout Code
      uses: actions/checkout@v3
    - name: Setup SDK
      uses: subosito/flutter-action@v2
      with:
        flutter-version: "3.0"
        cache: true
    - uses: PRODYNA/flutter-test-action@v1
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
        project: ./app
```

## Code in Main

> First, you'll need to have a reasonably modern version of `node` handy. This won't work with versions older than 9, for instance.

Install the dependencies

```bash
npm install
```

Build the typescript and package it for distribution

```bash
npm run build && npm run package
```

Run the tests :heavy_check_mark:

```bash
$ npm test

 PASS  ./index.test.js
  ✓ throws invalid number (3ms)
  ✓ wait 500 ms (504ms)
  ✓ test runs (95ms)

...
```

## Change action.yml

The action.yml defines the inputs and output for your action.

See the [documentation](https://help.github.com/en/articles/metadata-syntax-for-github-actions)

## Change the Code

Most toolkit and CI/CD operations involve async operations so the action is run in an async function.

See the [toolkit documentation](https://github.com/actions/toolkit/blob/master/README.md#packages) for the various packages.

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder.

Then run [ncc](https://github.com/zeit/ncc) and push the results:

```bash
npm run package
git add dist
git commit -a -m "prod dependencies"
git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket:

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Validate

You can now validate the action by referencing `./` in a workflow in your repo (see [test.yml](.github/workflows/test.yml))

```yaml
uses: ./
with:
  token: ${{ secrets.GITHUB_TOKEN }}
  project: app
```

See the [actions tab](https://github.com/actions/typescript-action/actions) for runs of this action! :rocket:

## Create a Tag

After testing you can [create a v1 tag](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md) to reference the stable and latest V1 action
