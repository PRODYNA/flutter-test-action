import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as github from '@actions/github';
import * as events from './test_events'
import * as test_report from './classes';
import { SummaryTableRow } from '@actions/core/lib/summary';

class GroupContainer {
  groups: Map<number, Group>;
  tests: Map<number, Test>;

  constructor() {
    this.groups = new Map();
    this.tests = new Map();
  }
}

class Suite extends GroupContainer {
  path?: string;

  constructor(data: test_report.Suite, cwd: string) {
    super();
    this.path = data.path?.replace(cwd, "");
  }
}

class Group extends GroupContainer {
  hasTests(): boolean {
    for (let [_, test] of this.tests) {
      if (!test.hidden) return true;
    }
    return false;
  }

  name: string;
  line?: number;
  testCount: number;

  constructor(data: test_report.Group) {
    super()
    this.name = data.name;
    this.line = data.line;
    this.testCount = data.testCount;
  }
}

class Test {
  hidden: boolean = false;
  result?: "error" | "success" | "failure";
  name: string;
  skipped: boolean = false;
  line?: number;

  onDone(data: events.TestDoneEvent) {
    this.hidden = data.hidden;
    this.result = data.result;
    this.skipped = data.skipped;
  }

  constructor(data: test_report.Test, public suite: Suite) {
    this.name = data.name;
    this.line = data.root_line ?? data.line;
  }
}

async function run(): Promise<void> {
  try {
    const directory = core.getInput("project");
    const token = core.getInput("token");
    core.summary.addHeading("Test Results", 1);
    var expectedSuites = 0;
    var suites: Map<number, Suite> = new Map();
    var groups: Map<number, Group> = new Map();
    var tests: Map<number, Test> = new Map();

    let octokit = github.getOctokit(token);

    const owner = github.context.repo.owner;
    const repo = github.context.repo.repo;
    const sha = github.context.sha;

    let check_run_create_response = await octokit.rest.checks.create({
      owner: owner,
      repo: repo,
      name: `test (${directory})`,
      head_sha: sha,
      status: 'in_progress'
    });
    if (check_run_create_response.status != 201) {
      core.setFailed("Could not create check run")
      return;
    }
    let check_run = check_run_create_response.data;
    let conclusion: boolean | undefined | null = undefined;
    let summary = null;

    let cwd = process.cwd()
    await exec.exec("flutter", ["test", "-r", "json"], {
      cwd: directory,
      listeners: {
        stdline: (line) => {
          const data: events.Event = JSON.parse(line);
          if (data.type == "done") {
            if (data.success === true) {
              summary = "All tests succeeded";
              conclusion = true;
            } else if (data.success === false) {
              summary = "Some tests failed";
              conclusion = false;
            } else {
              summary = "Test runner terminated early";
              conclusion = null;
            }
            core.summary.addRaw(summary);
          } else if (data.type == "suite") {
            expectedSuites -= 1;
            const id = data.suite.id;
            suites.set(id, new Suite(data.suite, cwd));
          } else if (data.type == "allSuites") {
            expectedSuites += data.count;
          } else if (data.type == "group") {
            const group = new Group(data.group);
            const groupID = data.group.id;
            const parentID = data.group.parentID;
            const suiteID = data.group.suiteID;
            const parent: GroupContainer = parentID == null ? suites.get(suiteID)! : groups.get(parentID)!;
            parent.groups.set(groupID, group);
            groups.set(groupID, group);
          } else if (data.type == "testStart") {
            const testID = data.test.id;
            const suiteID = data.test.suiteID;
            const groupIDs = data.test.groupIDs;
            const suite = suites.get(suiteID)!;
            const test = new Test(data.test, suite);

            let parent: GroupContainer = suites.get(suiteID)!;
            let name = data.test.name;
            for (const id of groupIDs) {
              let group = parent.groups.get(id)!;
              if (group.name.length > 0) {
                if (name.startsWith(group.name)) {
                  name = name.substring(group.name.length).trimStart()
                }

              }
              parent = group;
            }
            test.name = name;
            parent.tests.set(testID, test);
            tests.set(testID, test);
          } else if (data.type == "testDone") {
            const test = tests.get(data.testID)!;
            test.onDone(data);
          }
        }
      }
    });

    function printGroup(group: Group, hLevel: number) {
      if (group.hasTests()) {
        core.summary.addRaw("", true);
        core.summary.addRaw("| Result | Name |", true);
        core.summary.addRaw("| --- | --- |", true);
        for (let [_, t] of group.tests) {
          let url = `https://github.com/${owner}/${repo}/tree/${sha}${t.suite.path}#L${t.line}`;
          if (!t.hidden) {
            let mark = {
              success: '✔️',
              error: '🚩',
              failure: '❌',
              unde: '❓',
            }[t.result ?? 'unde'];
            core.summary.addRaw(`${mark} | [${t.name}](${url})`, true);
          }
        }
        core.summary.addRaw("", true);
      }

      const hLevelInner = hLevel + 1;
      for (let [_, g] of group.groups) {
        core.summary.addHeading(`${g.name}`, hLevel);
        printGroup(g, hLevelInner);
      }
    }

    for (let [key, suite] of suites) {
      core.summary.addHeading(suite.path || `Suite ${key}`, 2);
      for (let [_, group] of suite.groups) {
        printGroup(group, 3)
      }
    }

    let text = core.summary.stringify()
    core.summary.clear();

    let check_update_response = await octokit.rest.checks.update({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      check_run_id: check_run.id,
      status: 'completed',
      conclusion: (conclusion === true) ? 'success' : (conclusion === false) ? 'failure' : 'timed_out',
      output: {
        title: `Tests of ${directory}`,
        summary: summary,
        text: text,
      }
    });
    if (check_update_response.status != 200) {
      core.setFailed(`Failed to update check`);
    }

    /*if (result != 0) {
      core.setFailed(`Test runner failed (exit code ${result}`);
    }*/
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
