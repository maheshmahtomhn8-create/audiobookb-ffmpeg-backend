
const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post(
  "/render",
  upload.fields([
    { name: "images", maxCount: 50 },
    { name: "voice", maxCount: 1 },
    { name: "music", maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const images = req.files.images || [];
      const voice = req.files.voice?.[0];
      const music = req.files.music?.[0];

      if (!voice || images.length === 0) {
        return res.status(400).send("Images and voiceover are required");
      }

      const fps = req.body.fps || 30;
      const bitrate = req.body.bitrate || "8M";
      const output = `output_${Date.now()}.mp4`;

      let concatFile = "";
      images.forEach(img => {
        concatFile += `file '${path.resolve(img.path)}'\n`;
        concatFile += `duration 5\n`;
      });

      fs.writeFileSync("images.txt", concatFile);

      const ffmpegCmd = `
ffmpeg -y \
-f concat -safe 0 -i images.txt \
-i ${path.resolve(voice.path)} ${music ? `-i ${path.resolve(music.path)}` : ""} \
-filter_complex "${music ? "[2:a]volume=0.3[a2];[1:a][a2]amix=inputs=2[a]" : ""}" \
-map 0:v -map ${music ? "[a]" : "1:a"} \
-c:v libx264 -r ${fps} -b:v ${bitrate} \
-c:a aac -pix_fmt yuv420p \
${output}
`;

      exec(ffmpegCmd, (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send("FFmpeg rendering failed");
        }

        res.download(output, () => {
          try {
            fs.unlinkSync(output);
            fs.unlinkSync("images.txt");
            images.forEach(i => fs.unlinkSync(i.path));
            fs.unlinkSync(voice.path);
            if (music) fs.unlinkSync(music.path);
          } catch (e) {
            console.error("Cleanup error:", e);
          }
        });
      });

    } catch (e) {
      console.error(e);
      res.status(500).send("Server error");
    }
  }
);

// 🔥 RENDER-SAFE PORT (IMPORTANT)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
