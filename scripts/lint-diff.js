const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';

function run(command) {
    try {
        const stdout = execSync(command, { encoding: 'utf8', stdio: 'pipe' }).trim();
        return stdout;
    } catch (error) {
        const stdout = error.stdout ? error.stdout.trim() : '';
        const stderr = error.stderr ? error.stderr.trim() : '';

        // Some tools (like Stylelint) output JSON to stderr when they find errors
        if (!stdout && (stderr.startsWith('[') || stderr.startsWith('{'))) {
            return stderr;
        }

        return stdout || '';
    }
}



function getStagedFiles() {
    const output = run("git diff --cached --name-only --diff-filter=ACM");
    if (!output) return [];
    // Filter out empty lines and trim whitespace
    return output.split('\n').map(f => f.trim()).filter(Boolean);
}

function getChangedLines(filePath) {
    const diff = run(`git diff --cached --unified=0 --text "${filePath}"`);
    const changedLines = new Set();
    const hunkHeaderRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

    if (!diff) return changedLines;

    diff.split('\n').forEach(line => {
        const match = line.match(hunkHeaderRegex);
        if (match) {
            const start = parseInt(match[1], 10);
            const count = match[2] ? parseInt(match[2], 10) : 1;
            for (let i = 0; i < count; i++) {
                changedLines.add(start + i);
            }
        }
    });

    return changedLines;
}

function getLineContent(filePath, lineNumber) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const line = lines[lineNumber - 1];
        return line ? line.trim() : '';
    } catch (e) {
        return '';
    }
}

function lintJS(files) {
    const jsFiles = files.filter(file => file.match(/\.(js|ts|jsx|tsx|mjs|cjs)$/));
    if (jsFiles.length === 0) return [];

    console.log(`Checking ${jsFiles.length} JavaScript/TypeScript file(s) with ESLint...`);

    const npx = isWindows ? 'npx.cmd' : 'npx';
    const cmd = `${npx} eslint --format=json ${jsFiles.map(f => `"${f}"`).join(' ')}`;
    const resultJson = run(cmd);

    if (!resultJson) return [];
    try {
        return JSON.parse(resultJson);
    } catch (e) {
        console.error("Error parsing ESLint JSON:", e);
        console.error("Raw ESLint output:", resultJson);
        return [];
    }
}

function lintCSS(files) {
    const cssFiles = files.filter(file => file.match(/\.(css|scss|sass)$/));
    if (cssFiles.length === 0) return [];

    console.log(`Checking ${cssFiles.length} CSS/SCSS file(s) with Stylelint...`);

    const npx = isWindows ? 'npx.cmd' : 'npx';
    // Stylelint format is slightly different but we can get JSON
    const cmd = `${npx} stylelint --formatter json ${cssFiles.map(f => `"${f}"`).join(' ')}`;
    const resultJson = run(cmd);

    if (!resultJson) return [];
    try {
        // Stylelint results are nearly identical structure to ESLint JSON for our purposes
        const results = JSON.parse(resultJson);
        // Normalize results to match the filter logic
        return results.map(res => ({
            filePath: res.source,
            messages: res.warnings.map(w => ({
                line: w.line,
                column: w.column,
                severity: w.severity === 'error' ? 2 : 1,
                message: w.text,
                ruleId: w.rule
            }))
        }));
    } catch (e) {
        console.error("Error parsing Stylelint JSON:", e);
        console.error("Raw Stylelint output:", resultJson);
        return [];
    }
}

function filterErrors(results, changedLinesMap) {
    let totalErrors = 0;
    let totalWarnings = 0;
    const filteredResults = [];

    const normalizePath = (p) => p.replace(/\\/g, '/').toLowerCase();

    results.forEach(result => {
        // Normalize the file path from the tool to match git's forward-slash format
        let rawPath = result.filePath;
        if (path.isAbsolute(rawPath)) {
            rawPath = path.relative(process.cwd(), rawPath);
        }
        const filePath = rawPath.replace(/\\/g, '/');

        // Find the key in the map in a case-insensitive way
        const normalizedFilePath = normalizePath(filePath);
        let changed = null;
        for (const [key, value] of changedLinesMap.entries()) {
            if (normalizePath(key) === normalizedFilePath) {
                changed = value;
                break;
            }
        }

        if (!changed) {
            return;
        }

        const messages = result.messages.filter(msg => {
            if (!msg.line) return true;
            return changed.has(msg.line);
        });

        if (messages.length > 0) {
            filteredResults.push({
                filePath,
                messages,
                errorCount: messages.filter(m => m.severity === 2).length,
                warningCount: messages.filter(m => m.severity === 1).length
            });
            totalErrors += messages.filter(m => m.severity === 2).length;
            totalWarnings += messages.filter(m => m.severity === 1).length;
        }
    });

    return { filteredResults, totalErrors, totalWarnings };
}

function printReport(data) {
    const { filteredResults, totalErrors, totalWarnings } = data;

    if (filteredResults.length === 0) {
        console.log(`\n✔  No issues found in changed lines.\n`);
        return;
    }

    console.log(`\n---------------- QUALITY CHECKS ----------------\n`);

    if (totalErrors > 0) {
        console.log(`⛔  BLOCKER\n`);
    } else {
        console.log(`⚠️  WARNINGS FOUND\n`);
    }

    filteredResults.forEach(res => {
        res.messages.forEach(msg => {
            const isError = msg.severity === 2;
            const icon = isError ? '⛔' : '⚠️ ';
            const label = isError ? 'BLOCKER' : 'WARNING';
            const codeSnippet = getLineContent(res.filePath, msg.line);

            console.log(`   ${icon} ${label}\n`);
            console.log(`   ┌─────────────────────────────────────────────────────────────────`);
            console.log(`   │  📄 FILE   : ${path.basename(res.filePath).padEnd(46)} `);
            console.log(`   │  📍 LINE   : ${String(msg.line).padEnd(46)} `);
            if (codeSnippet) {
                const snippet = codeSnippet.length > 44 ? codeSnippet.substring(0, 41) + '...' : codeSnippet;
                console.log(`   │  💻 CODE   : ${snippet.padEnd(46)} `);
            }
            const reason = msg.message;
            console.log(`   │  ➡️  REASON : ${reason.padEnd(46)} `);
            console.log(`   └─────────────────────────────────────────────────────────────────`);
            console.log(``);
        });
    });

    console.log(`Found ${totalErrors} errors and ${totalWarnings} warnings.`);
}

function main() {
    const stagedFiles = getStagedFiles();
    if (stagedFiles.length === 0) process.exit(0);

    const changedLinesMap = new Map();
    stagedFiles.forEach(file => {
        changedLinesMap.set(file, getChangedLines(file));
    });

    const esResults = lintJS(stagedFiles);
    const styleResults = lintCSS(stagedFiles);
    const allResults = [...esResults, ...styleResults];

    const data = filterErrors(allResults, changedLinesMap);

    printReport(data);

    if (data.totalErrors > 0) {
        process.exit(1);
    }
}

main();
