import { Test, Suite, Group } from './classes'

interface BaseEvent {
  // The type of the event.
  //
  // This is always one of the subclass types listed below.
  type: string

  // The time (in milliseconds) that has elapsed since the test runner started.
  time: number
}

interface StartEvent extends BaseEvent {
  type: 'start'

  // The version of the JSON reporter protocol being used.
  //
  // This is a semantic version, but it reflects only the version of the
  // protocol—it's not identical to the version of the test runner itself.
  protocolVersion: string

  // The version of the test runner being used.
  //
  // This is null if for some reason the version couldn't be loaded.
  runnerVersion?: string

  // The pid of the VM process running the tests.
  pid: number
}

interface AllSuitesEvent extends BaseEvent {
  type: 'allSuites'

  /// The total number of suites that will be loaded.
  count: number
}

interface SuiteEvent extends BaseEvent {
  type: 'suite'

  /// Metadata about the suite.
  suite: Suite
}

interface DebugEvent extends BaseEvent {
  type: 'debug'

  /// The suite for which debug information is reported.
  suiteID: number

  /// The HTTP URL for the Dart Observatory, or `null` if the Observatory isn't
  /// available for this suite.
  observatory?: string

  /// The HTTP URL for the remote debugger for this suite's host page, or `null`
  /// if no remote debugger is available for this suite.
  remoteDebugger?: string
}

interface GroupEvent extends BaseEvent {
  type: 'group'

  /// Metadata about the group.
  group: Group
}

interface TestStartEvent extends BaseEvent {
  type: 'testStart'

  // Metadata about the test that started.
  test: Test
}

interface MessageEvent extends BaseEvent {
  type: 'print'

  // The ID of the test that printed a message.
  testID: number

  // The type of message being printed.
  messageType: 'print' | 'skip'

  // The message that was printed.
  message: string
}

interface ErrEvent extends BaseEvent {
  type: 'error'

  // The ID of the test that experienced the error.
  testID: number

  // The result of calling toString() on the error object.
  error: string

  // The error's stack trace, in the stack_trace package format.
  stackTrace: string

  // Whether the error was a TestFailure.
  isFailure: boolean
}

interface TestDoneEvent extends BaseEvent {
  type: 'testDone'

  // The ID of the test that completed.
  testID: number

  // The result of the test.
  result: 'success' | 'failure' | 'error'

  // Whether the test's result should be hidden.
  hidden: boolean

  // Whether the test (or some part of it) was skipped.
  skipped: boolean
}

interface DoneEvent extends BaseEvent {
  type: 'done'

  // Whether all tests succeeded (or were skipped).
  //
  // Will be `null` if the test runner was close before all tests completed
  // running.
  success?: boolean
}

type Event =
  | StartEvent
  | AllSuitesEvent
  | SuiteEvent
  | DebugEvent
  | GroupEvent
  | TestStartEvent
  | MessageEvent
  | ErrEvent
  | TestDoneEvent
  | DoneEvent
  | { type: 'non-exhaustive' }

export {
  Event,
  StartEvent,
  AllSuitesEvent,
  SuiteEvent,
  DebugEvent,
  GroupEvent,
  TestStartEvent,
  MessageEvent,
  ErrEvent,
  TestDoneEvent,
  DoneEvent,
  BaseEvent
}
