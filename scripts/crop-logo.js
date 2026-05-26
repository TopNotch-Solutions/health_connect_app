// Dev-only script. Install sharp locally before running:
//   npm install --no-save sharp
//   node scripts/crop-logo.js
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error(
    "sharp is not installed. Run: npm install --no-save sharp",
  );
  process.exit(1);
}
const path = require('path');

async function cropLogo() {
  try {
    const inputPath = path.join(__dirname, '..', 'assets', 'images', 'healthconnectlogo.png');
    const outputPath = path.join(__dirname, '..', 'assets', 'images', 'healthconnectlogo-cropped.png');

    // Read and trim whitespace
    await sharp(inputPath)
      .trim() // Automatically remove whitespace/transparent borders
      .toFile(outputPath);

    console.log('✅ Logo cropped successfully!');
    console.log('New logo saved as: healthconnectlogo-cropped.png');
    console.log('To use it, update your imports from "healthconnectlogo.png" to "healthconnectlogo-cropped.png"');
  } catch (error) {
    console.error('❌ Error cropping logo:', error.message);
  }
}

cropLogo();
