import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'
import * as events from './testEvents'
import * as test_report from './classes'

class GroupContainer {
  groups: Map<number, Group>
  tests: Map<number, Test>

  constructor() {
    this.groups = new Map()
    this.tests = new Map()
  }
}

class Suite extends GroupContainer {
  path?: string

  constructor(data: test_report.Suite, cwd: string) {
    super()
    this.path = data.path?.replace(cwd, '')
  }
}

class Group extends GroupContainer {
  hasTests(): boolean {
    for (const [_, test] of this.tests) {
      if (!test.hidden) return true
    }
    return false
  }

  name: string
  line?: number
  testCount: number

  constructor(data: test_report.Group) {
    super()
    this.name = data.name
    this.line = data.line
    this.testCount = data.testCount
  }
}

class Test {
  hidden = false
  result?: 'error' | 'success' | 'failure'
  name: string
  skipped = false
  line?: number

  onDone(data: events.TestDoneEvent): void {
    this.hidden = data.hidden
    this.result = data.result
    this.skipped = data.skipped
  }

  constructor(data: test_report.Test, public suite: Suite) {
    this.name = data.name
    this.line = data.root_line ?? data.line
  }
}

interface CheckRun {
  id: number
}

interface UpdateCheckRunOptions {
  check_run: CheckRun
  conclusion?: boolean
  summary: string
  text: string
}

class Runner {
  owner: string
  repo: string
  sha: string
  baseUrl: string
  octokit: InstanceType<typeof GitHub>

  constructor(token: string, private directory: string) {
    const context = github.context
    this.owner = context.repo.owner
    this.repo = context.repo.repo
    this.sha = context.sha
    this.baseUrl = `https://github.com/${this.owner}/${this.repo}/tree/${this.sha}`
    this.octokit = github.getOctokit(token)
  }

  printGroup(group: Group, hLevel: number): void {
    if (group.hasTests()) {
      core.summary.addRaw('', true)
      core.summary.addRaw('| Result | Name |', true)
      core.summary.addRaw('| --- | --- |', true)
      for (const [_, t] of group.tests) {
        const url = `${this.baseUrl}${t.suite.path}#L${t.line}`
        if (!t.hidden) {
          const mark = {
            success: '✔️',
            error: '🚩',
            failure: '❌',
            unde: '❓'
          }[t.result ?? 'unde']
          core.summary.addRaw(`${mark} | [${t.name}](${url})`, true)
        }
      }
      core.summary.addRaw('', true)
    }

    const hLevelInner = hLevel + 1
    for (const [_, g] of group.groups) {
      core.summary.addHeading(`${g.name}`, hLevel)
      this.printGroup(g, hLevelInner)
    }
  }

  async newCheckRun(): Promise<{ id: number }> {
    const check_run_create_response = await this.octokit.rest.checks.create({
      owner: this.owner,
      repo: this.repo,
      name: `test (${this.directory})`,
      head_sha: this.sha,
      status: 'in_progress'
    })
    return check_run_create_response.data
  }

  private conclusionStr(
    conclusion?: boolean
  ): 'success' | 'failure' | 'timed_out' {
    if (conclusion === true) {
      return 'success'
    } else if (conclusion === false) {
      return 'failure'
    } else {
      return 'timed_out'
    }
  }

  async updateCheckRun({
    check_run,
    summary,
    text,
    conclusion
  }: UpdateCheckRunOptions): Promise<void> {
    await this.octokit.rest.checks.update({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      check_run_id: check_run.id,
      status: 'completed',
      conclusion: this.conclusionStr(conclusion),
      output: {
        title: `Tests of ${this.directory}`,
        summary,
        text
      }
    })
  }
}

async function run(): Promise<void> {
  try {
    const directory = core.getInput('project')
    const token = core.getInput('token')
    core.summary.addHeading('Test Results', 1)
    let expectedSuites = 0
    const suites: Map<number, Suite> = new Map()
    const groups: Map<number, Group> = new Map()
    const tests: Map<number, Test> = new Map()

    const runner = new Runner(token, directory)
    const check_run = await runner.newCheckRun()

    let conclusion: boolean | undefined | null = undefined
    let summary: string | null = null

    const cwd = process.cwd()
    await exec.exec('flutter', ['test', '-r', 'json'], {
      cwd: directory,
      listeners: {
        stdline: (line: string) => {
          const data: events.Event = JSON.parse(line)
          if (data.type === 'done') {
            if (data.success === true) {
              summary = 'All tests succeeded'
              conclusion = true
            } else if (data.success === false) {
              summary = 'Some tests failed'
              conclusion = false
            } else {
              summary = 'Test runner terminated early'
              conclusion = null
            }
            core.summary.addRaw(summary)
          } else if (data.type === 'suite') {
            const id = data.suite.id
            suites.set(id, new Suite(data.suite, cwd))
          } else if (data.type === 'allSuites') {
            expectedSuites += data.count
          } else if (data.type === 'group') {
            const group = new Group(data.group)
            const groupID = data.group.id
            const parentID = data.group.parentID
            const suiteID = data.group.suiteID
            const parent: GroupContainer =
              parentID === null ? suites.get(suiteID)! : groups.get(parentID)!
            parent.groups.set(groupID, group)
            groups.set(groupID, group)
          } else if (data.type === 'testStart') {
            const testID = data.test.id
            const suiteID = data.test.suiteID
            const groupIDs = data.test.groupIDs
            const suite = suites.get(suiteID)!
            const test = new Test(data.test, suite)

            let parent: GroupContainer = suites.get(suiteID)!
            let name = data.test.name
            for (const id of groupIDs) {
              const group = parent.groups.get(id)!
              if (group.name.length > 0) {
                if (name.startsWith(group.name)) {
                  name = name.substring(group.name.length).trimStart()
                }
              }
              parent = group
            }
            test.name = name
            parent.tests.set(testID, test)
            tests.set(testID, test)
          } else if (data.type === 'testDone') {
            const test = tests.get(data.testID)!
            test.onDone(data)
          }
        }
      }
    })

    for (const [key, suite] of suites) {
      core.summary.addHeading(suite.path || `Suite ${key}`, 2)
      for (const [_, group] of suite.groups) {
        runner.printGroup(group, 3)
      }
    }

    core.summary.addRaw(`\nRan ${suites.size}/${expectedSuites} Suites`)
    const text = core.summary.stringify()
    core.summary.clear()

    runner.updateCheckRun({
      check_run,
      conclusion,
      summary: summary ?? '<missing summary>',
      text
    })
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
