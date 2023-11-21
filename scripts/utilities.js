import fs from "fs/promises";

async function cloneLibraryRepo(repoUrl, localSavePath) {
  const git = simpleGit();

  console.log("Cloning repository ...");
  try {
    await git.clone(repoUrl, localSavePath, [
      "--depth",
      "1",
      "--filter=blob:none",
    ]);
    console.log("Repository cloned successfully.");
  } catch (err) {
    console.error(`Error cloning repo: ${err}`);
  }
}

// This is a fix for the use of an absolute path in the preprocessor.js file in p5.js
async function fixForAbsolutePathInPreprocessor(localSavePath) {
  try {
    const preprocessorPath = `${localSavePath}/docs/preprocessor.js`;

    let preprocessorContent = await fs.readFile(preprocessorPath, "utf8");

    // Modify the absolute path in the preprocessor file
    preprocessorContent = preprocessorContent.replace(
      "path.join(process.cwd(), 'docs', 'parameterData.json')",
      `path.join(process.cwd(), '${localSavePath}/docs', 'parameterData.json')`
    );

    await fs.writeFile(preprocessorPath, preprocessorContent, "utf8");
    console.log("Preprocessor file modified successfully.");
  } catch (err) {
    console.error(`Error modifying absolute path in preprocessor: ${err}`);
  }
}

async function fileExistsAt(path) {
  return fs
    .access(path)
    .then(() => true)
    .catch(() => false);
}

async function isModifiedWithin24Hours(path) {
  try {
    const stats = await fs.stat(path);
    const modifiedTime = stats.mtime.getTime();
    const currentTime = Date.now();
    const twentyFourHoursAgo = currentTime - 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    return modifiedTime >= twentyFourHoursAgo;
  } catch (err) {
    console.error(`Error checking modification time: ${err}`);
    return false;
  }
}

export {
  cloneLibraryRepo,
  fixForAbsolutePathInPreprocessor,
  fileExistsAt,
  isModifiedWithin24Hours,
};
