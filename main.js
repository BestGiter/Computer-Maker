function getPeerId() {
    let id = localStorage.getItem("peer_id");

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("peer_id", id);
    }

    return id;
}
const message_box = document.getElementById("message-box")
const code_box = document.getElementById("room-code-box")
const your_box = document.getElementById("your-code-box")

async function send() {
    try {
        let conn = await connectToPeer(peer, code_box.value)
        conn.send({text: message_box.value})
    } catch (error) {
        console.log(error)
    }
}
function connectToPeer(peer, room_code) {
    return fetch("https://rendezvous-huzh.onrender.com/join", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "room_code": room_code
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.peer_id === undefined) {
            throw new Error("Room doesn't exist")
        }
        let conn = peer.connect(data.peer_id);
        return new Promise(resolve => {
            conn.on("open", () => resolve(conn));
        });
    });
}

const peer = new Peer(getPeerId());

peer.on("open", id => {
    fetch("https://rendezvous-huzh.onrender.com/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "peer_id": id
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.room_code)
        your_box.textContent = data.room_code
    })
})

peer.on("connection", conn => {
    conn.on("data", data => {
        let message = document.createElement("h1")
        message.textContent = data.text
        document.body.appendChild(message)
    })
})
