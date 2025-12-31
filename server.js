const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

app.post(
  "/render",
  upload.fields([
    { name: "images", maxCount: 20 },
    { name: "voice", maxCount: 1 },
    { name: "music", maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const images = req.files.images;
      const voice = req.files.voice[0].path;
      const music = req.files.music ? req.files.music[0].path : null;

      const fps = req.body.fps || 30;
      const bitrate = req.body.bitrate || "8M";
      const output = `video_${Date.now()}.mp4`;

      let list = "";
      images.forEach(img => {
        list += `file '${img.path}'\nduration 5\n`;
      });
      fs.writeFileSync("images.txt", list);

      const cmd = `
ffmpeg -y \
-f concat -safe 0 -i images.txt \
-i ${voice} ${music ? `-i ${music}` : ""} \
-filter_complex "${music ? "[2:a]volume=0.3[a2];[1:a][a2]amix=inputs=2[a]" : ""}" \
-map 0:v -map ${music ? "[a]" : "1:a"} \
-c:v libx264 -r ${fps} -b:v ${bitrate} \
-c:a aac -pix_fmt yuv420p \
${output}
`;

      exec(cmd, err => {
        if (err) return res.status(500).send("FFmpeg error");

        res.download(output, () => {
          fs.unlinkSync(output);
          fs.unlinkSync("images.txt");
          images.forEach(i => fs.unlinkSync(i.path));
          fs.unlinkSync(voice);
          if (music) fs.unlinkSync(music);
        });
      });

    } catch {
      res.status(500).send("Backend error");
    }
  }
);

app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
