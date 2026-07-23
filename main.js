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
        conn.close()
    } catch (error) {
        console.log(error)
    }
}

const cache = {
    peers: {}
}

async function connectToPeer(peer, room_code) {
    let peer_id = cache.peers[room_code];

    if (!peer_id) {
        const response = await fetch("https://rendezvous-huzh.onrender.com/join", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                room_code: room_code
            })
        });

        const data = await response.json();
        peer_id = data.peer_id;

        cache.peers[room_code] = peer_id;
    }

    const conn = peer.connect(peer_id);

    return new Promise(resolve => {
        conn.on("open", () => resolve(conn));
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
peer.on("error", err => {
    console.log(err)
})
peer.on("connection", conn => {
    conn.on("data", data => {
        let message = document.createElement("h1")
        message.textContent = data.text
        document.body.appendChild(message)
    })
})
