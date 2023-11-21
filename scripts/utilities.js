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

export { cloneLibraryRepo, fixForAbsolutePathInPreprocessor };
