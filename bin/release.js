const simpleGit = require('simple-git');
const git = simpleGit();
const packageJsonPath = '../package.json';
const packageJson = require(packageJsonPath);
const fs = require('fs').promises;
const npmPublish = require("@jsdevtools/npm-publish");

async function release({
    releaseType,
    commit
}) {
    try {
        const versionNumbers = packageJson.version.split('.');
        let major = versionNumbers[0];
        let minor = versionNumbers[1];
        let patch = versionNumbers[2];
        if (releaseType === "major") {
            major = Number(major) + 1;
        }
        else if (releaseType === "minor") {
            minor = Number(minor) + 1;
        }
        else if (releaseType === "patch") {
            patch = Number(patch) + 1;
        }
        const newVersionNumber = `${major}.${minor}.${patch}`;
        packageJson.version = newVersionNumber;
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 4));
        await git.add('*').commit(commit).push().addTag(packageJson.version);
        await npmPublish({
            token: process.env.INPUT_TOKEN
        });
    }
    catch (e) {
        console.log(e);
    }
}

exports.release = release;