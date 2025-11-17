const chatBox = document.querySelector(".chat-box");
const inputField = chatBox.querySelector("input[type='text']");
const button = chatBox.querySelector("button");
const chatBoxBody = chatBox.querySelector(".chat-box-body");

button.addEventListener("click", sendMessage);
inputField.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

function sendMessage() {
  const message = inputField.value;
  inputField.value = "";
  chatBoxBody.innerHTML += `<div class="message"><p>${message}</p></div>`;
  chatBoxBody.innerHTML += `<div id="loading" class="response loading">.</div>`;
  scrollToBottom();
  window.dotsGoingUp = true;
    var dots = window.setInterval(function() {
        var wait = document.getElementById("loading");
        if (!wait) { clearInterval(dots); return; }
        if (window.dotsGoingUp) 
            wait.innerHTML += ".";
        else {
            wait.innerHTML = wait.innerHTML.substring(1, wait.innerHTML.length);
            if (wait.innerHTML.length < 2)
                window.dotsGoingUp = true;
        }
        if (wait.innerHTML.length > 3)
            window.dotsGoingUp = false;
    }, 250);

  fetch('http://localhost:3000/message', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({message})
  }).then(response => {
    if (!response.ok) {
      return response.text().then(t => {
        throw new Error(`HTTP ${response.status} ${response.statusText}${t ? ` - ${t}` : ''}`);
      });
    }
    return response.json();
  }).then(data => {
    clearInterval(dots);
    document.getElementById("loading").remove();
    chatBoxBody.innerHTML += `<div class="response"><p>${data.message}</p></div>`;
    scrollToBottom();
  }).catch(err => {
    clearInterval(dots);
    const loader = document.getElementById("loading");
    if (loader) loader.remove();
    chatBoxBody.innerHTML += `<div class="response error"><p>Erreur: ${err?.message || 'Une erreur est survenue'}</p></div>`;
    scrollToBottom();
  })
}

function scrollToBottom() {
  chatBoxBody.scrollTop = chatBoxBody.scrollHeight;
}

