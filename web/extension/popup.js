// JobsAI — For LinkedIn · popup

const $ = (id) => document.getElementById(id);

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, (r) => resolve(r || {})));
}

async function render() {
  const { connected } = await send({ type: "GET_STATUS" });
  $("status").textContent = connected ? "Connected" : "Not connected";
  $("connected").hidden = !connected;
  $("disconnected").hidden = connected;
}

$("connect").addEventListener("click", async () => {
  const key = $("key").value.trim();
  const err = $("error");
  err.hidden = true;
  if (!key.startsWith("jsk_")) {
    err.textContent = "That doesn't look like a JobsAI key (starts with jsk_).";
    err.hidden = false;
    return;
  }
  await send({ type: "SET_API_KEY", apiKey: key });
  render();
});

$("disconnect").addEventListener("click", async () => {
  await send({ type: "DISCONNECT" });
  render();
});

render();
