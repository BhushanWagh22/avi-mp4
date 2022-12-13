const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createFFmpeg } = require("@ffmpeg/ffmpeg");
// const PQueue = require("p-queue");
const proxy = require("http-proxy-middleware");

const ffmpegInstance = createFFmpeg({ log: true });
let ffmpegLoadingPromise = ffmpegInstance.load();

// const requestQueue = new PQueue({ concurrency: 1 });

async function getFFmpeg() {
  if (ffmpegLoadingPromise) {
    await ffmpegLoadingPromise;
    ffmpegLoadingPromise = undefined;
  }

  return ffmpegInstance;
}

const app = express();
const port = process.env.PORT || 8000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

app.use(cors());
app.use(express.static("public"));

app.use(
  "/echoapp/convert/",
  proxy.createProxyMiddleware({
    target: "http://10.100.0.24:8000",
    secure: false,
    changeOrigin: true,
  })
);

app.use(
  "/echoapp/lv_segmentation",
  proxy.createProxyMiddleware({
    target: "http://10.100.0.24:8000",
    secure: false,
    changeOrigin: true,
  })
);

app.use(
  "/file",
  proxy.createProxyMiddleware({
    target: "http://10.100.0.23:8000",
    secure: false,
    changeOrigin: true,
  })
);

app.use(
  "/ECGAnn",
  proxy.createProxyMiddleware({
    target: "http://10.100.0.23:8000",
    secure: false,
    changeOrigin: true,
  })
);

app.use(
  "/ecgPrediction",
  proxy.createProxyMiddleware({
    target: "http://10.100.0.23:8060",
    secure: false,
    changeOrigin: true,
  })
);

app.get("/", (req, res) => {
  return res.json({ message: "helllooooooooooooooooo" });
});

app.post("/thumbnail", upload.single("video"), async (req, res) => {
  try {
    const videoData = req.file.buffer;

    const ffmpeg = await getFFmpeg();
    const inputFileName = `input-video`;
    const outputFileName = `output-video.mp4`;
    let outputData = null;

    // await requestQueue.add(async () => {
    ffmpeg.FS("writeFile", inputFileName, videoData);

    await ffmpeg.run(
      "-y",
      "-t",
      "10",
      "-i",
      inputFileName,
      "-filter_complex",
      "fps=10,scale=720:-1:flags=lanczos[x];[x]split[x1][x2];[x1]palettegen[p];[x2][p]paletteuse",
      "-f",
      "mp4",
      outputFileName
    );

    outputData = ffmpeg.FS("readFile", outputFileName);
    ffmpeg.FS("unlink", inputFileName);
    ffmpeg.FS("unlink", outputFileName);
    // });

    // res.sendStatus(200);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment;filename=${outputFileName}`,
      "Content-Length": outputData.length,
    });
    res.end(Buffer.from(outputData, "binary"));
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`[info] ffmpeg-api listening at http://localhost:${port}`);
});
