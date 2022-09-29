interface Metadata {
  skip: boolean

  // The reason the tests was skipped, or `null` if it wasn't skipped.
  skipReason?: string
}

interface Test {
  // An opaque ID for the test.
  id: number

  // The name of the test, including prefixes from any containing groups.
  name: string

  // The ID of the suite containing this test.
  suiteID: number

  // The IDs of groups containing this test, in order from outermost to
  // innermost.
  groupIDs: number[]

  // The (1-based) line on which the test was defined, or `null`.
  line?: number

  // The (1-based) column on which the test was defined, or `null`.
  column?: number

  // The URL for the file in which the test was defined, or `null`.
  url?: string

  // The (1-based) line in the original test suite from which the test
  // originated.
  //
  // Will only be present if `root_url` is different from `url`.
  root_line?: number

  // The (1-based) line on in the original test suite from which the test
  // originated.
  //
  // Will only be present if `root_url` is different from `url`.
  root_column?: number

  // The URL for the original test suite in which the test was defined.
  //
  // Will only be present if different from `url`.
  root_url?: string
}

interface Suite {
  // An opaque ID for the group.
  id: number

  // The platform on which the suite is running.
  platform: string

  // The path to the suite's file, or `null` if that path is unknown.
  path?: string
}

interface Group {
  // An opaque ID for the group.
  id: number

  // The name of the group, including prefixes from any containing groups.
  name: string

  // The ID of the suite containing this group.
  suiteID: number

  // The ID of the group's parent group, unless it's the root group.
  parentID: number

  // The number of tests (recursively) within this group.
  testCount: number

  // The (1-based) line on which the group was defined, or `null`.
  line?: number

  // The (1-based) column on which the group was defined, or `null`.
  column?: number

  // The URL for the file in which the group was defined, or `null`.
  url?: string

  // This field is deprecated and should not be used.
  metadata: Metadata
}

export { Test, Suite, Group, Metadata }
