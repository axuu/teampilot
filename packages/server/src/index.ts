import { createApp } from "./app.js";
import { startScheduler } from "./scheduler/index.js";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`server on :${port}`));
startScheduler();
