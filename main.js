room_code = "";
host = null;
let wiring_from = null;
let wiring_to = null;
let Ptouches = [];
let Ctouches = [];
const post = document.getElementById("post");
const post2 = document.getElementById("post2");
let smouse = {
    x: 0,
    y: 0
};
function getPeerId() {
    let id = localStorage.getItem("peer_id");

    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("peer_id", id);
    }

    return id;
}
const your_box = document.getElementById("your-code-box")
function sendToHost(host, data) {
    if (!host) {
        handleHost(getPeerId(), data)
    } else {
        host.send(data)
    }
}
const cache = {
    peers: {}
}

let world = {
    gates: {  // this will be like id: {name: name, id: id, value: value, x: x, y: y}
        0: {
            name: "AND",
            x: 0,
            y: 100,
            id: 0,
            value: 0
        },
        1: {
            name: "NOT",
            x: -100,
            y: 0,
            id: 1,
            value: 0
        },
        4: {
            name: "LEVER",
            x: -200,
            y: 0,
            id: 4,
            value: 0,
            enabled: 0
        }
    },
    wires: {  // this will be like id: {from: id1, to: id2, id: id, value: value}
        2: {
            _from: 1,
            _to: 0,
            id: 2
        },
        3: {
            _from: 4,
            _to: 1,
            id: 3
        }
    }
}
let currentId = 5;
let nextId = 5;
let needsUpdated = new Set();
let nextNeedsUpdated = new Set(Object.keys(world.gates));
function addUpdate(g) {
    nextNeedsUpdated.add(g);
}
function newGate(name, x, y, value = 0, idoff = 0) {
    let id = currentId+idoff;
    world.gates[id] = {
        name: name,
        x: x,
        y: y,
        value: value,
        id: id
    };
    requestAnimationFrame(() => addUpdate(id));
    return id;
}
let menu = false;
let create_menu = document.getElementById("create");
function create_gate() {
    menu = !menu;
    if (menu) {
        let i = 0;
        for (const gate of ["AND", "OR", "NOT", "LEVER", "BUFFER", "LASER"]) {
            let button = document.createElement("button");
            button.innerHTML = gate;
            button.style.position = "absolute";
            button.style.bottom = String((i+1)*40)+"px"
            button.classList.add("option");
            button.onclick = () => {
                const converted = toWorld({
                    x: canvas.width/2,
                    y: canvas.height/2
                }, camera)
                sendToHost(host, {
                    type: "creategate",
                    name: gate,
                    x: converted.x,
                    y: converted.y
                })
            };
            create_menu.appendChild(button);
            i++;
        }
    } else {
        create_menu.innerHTML = "";
    }
}
let delete_mode = false;
function delete_gate() {
    delete_mode = !delete_mode;
    wiring_mode = false;
    wiring_from = null;
    wiring_to = null;
    move_mode = false;
}
let move_mode = false;
let moving = null;
function move_gate() {
    move_mode = !move_mode;
    wiring_mode = false;
    wiring_from = null;
    wiring_to = null;
    delete_mode = false;
}
function newWire(_from, _to, idoff = 0) {
    let id = currentId+idoff;
    world.wires[id] = {
        _from: _from,
        _to: _to,
        id: id
    }
    return id;
}
let wiring_mode = false;
function wire_gates() {
    wiring_mode = !wiring_mode;
    delete_mode = false;
    move_mode = false;
}
function reserve(step) {
    nextId += step;
}
function step() {
    currentId = nextId;
}
function downloadWorld(world) {
    const data = JSON.stringify(world, null, 2);

    const blob = new Blob([data], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "world.json";
    a.click();

    URL.revokeObjectURL(url);
}
function getGateAt(x, y) {
    for (const gate of Object.values(world.gates)) {
        if (gate.x <= x && x < gate.x+50) {
            if (gate.y <= y && y < gate.y+50) {
                return gate;
            }
        }
    }
    return null;
}
//const picker = document.getElementById("filePicker");

//document.getElementById("open").onclick = () => {
    //picker.click();
//};

//picker.onchange = async () => {
    //const file = picker.files[0];
    //console.log(file.name);

    //const text = await file.text();
    //const json = JSON.parse(text)
    
//};
async function connectToPeer(peer, room_code) {
    let conn2 = cache.peers[room_code];
    let conn = null;

    if (!conn2) {
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
        const peer_id = data.peer_id;
        conn = peer.connect(peer_id)
    } else {        
        return conn2;
    }

    return new Promise((resolve, reject) => {
        conn.on("open", () => {
            cache.peers[room_code] = conn;
            resolve(conn);
        });
        conn.on("error", reject);
        conn.on("close", () => {
            delete cache.peers[room_code]
        })
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
        my_room_code = data.room_code
        gameloop()
    })
})
peer.on("error", err => {
    console.log(err)
})
let players = [];
let connections = [];
function handleHost(peer_id, data) {
    if (data.type == "join") {
        players.push({
            name: data.name,
            peer_id: peer_id,
            x: 0,
            y: 0,
            zoom: 1
        });
    } else if (data.type == "leave") {
        let player = players.find(p => p.peer_id === peer_id);

        let index = players.indexOf(player);

        if (index !== -1) {
            players.splice(index, 1);
        }
    } else if (data.type == "cursor") {
        let player = players.find(p => p.peer_id === peer_id);

        let index = players.indexOf(player);

        if (index !== -1) {
            players.splice(index, 1);
            let name = player.name;
            players.push({
                name: name,
                peer_id: peer_id,
                x: data.x,
                y: data.y,
                zoom: data.zoom
            });
        }
    } else if (data.type == "clickgate") {
        console.log("clickgate", data.id);
        let gate = world.gates[data.id];
        if (gate === undefined) {
            return
        }
        if (gate.name == "LEVER") {
            gate.enabled = gate.enabled!==undefined ? 1-gate.enabled : 1;
            nextNeedsUpdated.add(gate.id);
        }   
    } else if (data.type == "creategate") {
        reserve(1);
        newGate(data.name, data.x, data.y, 0, 0);
        step();
    } else if (data.type == "wiregates") {
        for (const w of Object.values(world.wires)) {
            if (w._from == data._from && w._to == data._to) {
                delete world.wires[w.id];
                return
            }
        }        
        requestAnimationFrame(() => addUpdate(data._from));
        requestAnimationFrame(() => addUpdate(data._to));
        reserve(1);
        newWire(data._from, data._to, 0)
        step();
    } else if (data.type == "deletegate") {
        for (const w of Object.values(world.wires)) {
            if (w._from == data.id || w._to == data.id) {
                if (data.id !== w._from) requestAnimationFrame(() => addUpdate(w._from));
                if (data.id !== w._to) requestAnimationFrame(() => addUpdate(w._to));
                delete world.wires[w.id];
            }
        }
        delete world.gates[data.id];
    } else if (data.type == "movegate") {
        world.gates[data.id].x = data.x;
        world.gates[data.id].y = data.y;
    }
}
peer.on("connection", conn => {
    connections.push(conn)
    conn.on("close", () => {
        connections = connections.filter(x => x !== conn);
    })
    // request handling
    conn.on("data", data => {
        handleHost(conn.peer, data)
    })
})

const canvas = document.getElementById("game");
let ctx = {};
let mode = "normal";
let myname = "host";
let mouse = {
    name: myname,
    x: 0,
    y: 0,
    zoom: 1
};
let camera = {
    x: 0,
    y: 0,
    zoom: 1
};
function toWorld(thing, camera) {
    return {
        x: (thing.x-camera.x)/camera.zoom,
        y: (thing.y-camera.y)/camera.zoom
    };
}
function toScreen(thing, camera) {
    return {
        x: thing.x*camera.zoom+camera.x,
        y: thing.y*camera.zoom+camera.y
    };
}


let testProgram = null;
let testBuffer = null;
let screenTexture = null;

function drawTest() {
    if (!gl) return;

    if (!testProgram) {
        const vertexShaderSource = `
            attribute vec2 position;

            varying vec2 uv;

            void main() {
                uv = vec2(
                    position.x * 0.5 + 0.5,
                    1.0 - (position.y * 0.5 + 0.5)
                );
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;

            uniform sampler2D screenTexture;

            varying vec2 uv;

            void main() {
                vec2 curvedUV = uv - 0.5; // move origin to center

                float curve = 0.1;
                float dist = dot(curvedUV, curvedUV);

                curvedUV *= 1.0 + dist * curve;
                float fade = 1.0-dist/2.0;

                curvedUV += 0.5; // move origin back
                if (curvedUV.x < 0.0 || curvedUV.x > 1.0
                ||  curvedUV.y < 0.0 || curvedUV.y > 1.0) {
                    // gl_FragColor = vec4(curve*dist/2.0, curve*dist/2.0, curve*dist/5.0, 1.0);
                    gl_FragColor = vec4(curve*dist/1.0, curve*dist/1.0, curve*dist/1.0, 1.0);
                    return;
                }
                vec4 col = texture2D(screenTexture, curvedUV);
                float multiplier = 1000.0;
                float pixel_bound = mod(curvedUV.x, 3.0/multiplier);
                float scale = 10.0;
                vec3 keeps = vec3(0.0, 0.0, 0.0);
                float centered = (2.0*(pixel_bound-1.0/multiplier)*multiplier)/scale;
                keeps.r += max(1.0 - (centered) * (centered), 0.0);
                centered = (2.0*(pixel_bound-2.0/multiplier)*multiplier)/scale;
                keeps.g += max(1.0-(centered*centered), 0.0);
                centered = (2.0*(pixel_bound-3.0/multiplier)*multiplier)/scale;
                keeps.b += max(1.0-(centered*centered), 0.0);
                col.rgb *= keeps;
                col.rgb *= fade;
                gl_FragColor = col;
            }
        `;

        function compileShader(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(gl.getShaderInfoLog(shader));
                return null;
            }

            return shader;
        }

        const vertexShader = compileShader(
            gl.VERTEX_SHADER,
            vertexShaderSource
        );

        const fragmentShader = compileShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource
        );

        if (!vertexShader || !fragmentShader) return;

        testProgram = gl.createProgram();

        gl.attachShader(testProgram, vertexShader);
        gl.attachShader(testProgram, fragmentShader);

        gl.linkProgram(testProgram);

        if (!gl.getProgramParameter(testProgram, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(testProgram));
            return;
        }

        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,

            -1,  1,
             1, -1,
             1,  1
        ]);

        testBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, testBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            vertices,
            gl.STATIC_DRAW
        );


        // Create texture
        screenTexture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, screenTexture);

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_S,
            gl.CLAMP_TO_EDGE
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_T,
            gl.CLAMP_TO_EDGE
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR
        );
    }


    // Copy the 2D canvas into the texture
    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, screenTexture);

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas // <-- your normal 2D canvas
    );


    gl.viewport(
        0,
        0,
        gl.canvas.width,
        gl.canvas.height
    );
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(testProgram);


    // Tell shader which texture to use
    const textureLocation =
        gl.getUniformLocation(
            testProgram,
            "screenTexture"
        );

    gl.uniform1i(textureLocation, 0);


    gl.bindBuffer(gl.ARRAY_BUFFER, testBuffer);

    const positionLocation =
        gl.getAttribLocation(
            testProgram,
            "position"
        );

    gl.enableVertexAttribArray(positionLocation);

    gl.vertexAttribPointer(
        positionLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0
    );


    gl.drawArrays(
        gl.TRIANGLES,
        0,
        6
    );
}
function drawUI() {
    ctx.fillStyle = "white";
    ctx.font = "bold 30px monospace";
    ctx.fillText("Room: " + my_room_code, 20, 40);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width/2-10, canvas.height/2);
    ctx.lineTo(canvas.width/2+10, canvas.height/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, canvas.height/2-10);
    ctx.lineTo(canvas.width/2, canvas.height/2+10);
    ctx.stroke();
    ctx.strokeStyle = "grey";
    ctx.lineWidth = 4;
    ctx.fillStyle = "grey";
    
    let size, val, currpos;
    
    ctx.strokeRect(0, canvas.height-40, 100, 40);
    ctx.font = "bold 30px monospace";
    val = input.value+" ";
    size = ctx.measureText(val).width;
    ctx.font = `bold ${100/size*30}px monospace`
    currpos = 0;
    i = 0;
    for (const l of val) {
        if (input.selectionStart <= i && i < input.selectionEnd) {
            ctx.fillStyle = "blue";
        } else {
            ctx.fillStyle = "grey";
        }
        ctx.fillText(l, currpos, canvas.height-10);
        if (input.selectionStart == i) {
            ctx.fillStyle = "blue";
            ctx.fillText("_", currpos, canvas.height-10);
        }
        currpos += ctx.measureText(l).width;
        i += 1;
    }
    
    ctx.strokeRect(100, canvas.height-40, 100, 40);
    ctx.font = "bold 30px monospace";
    val = input2.value+" ";
    size = ctx.measureText(val).width;
    ctx.font = `bold ${100/size*30}px monospace`
    currpos = 100;
    i = 0;
    for (const l of val) {
        if (input2.selectionStart <= i && i < input2.selectionEnd) {
            ctx.fillStyle = "blue";
        } else {
            ctx.fillStyle = "grey";
        }
        ctx.fillText(l, currpos, canvas.height-10);
        if (input2.selectionStart == i) {
            ctx.fillStyle = "blue";
            ctx.fillText("_", currpos, canvas.height-10);
        }
        currpos += ctx.measureText(l).width;
        i += 1;
    }
    
    ctx.fillStyle = "grey";
    ctx.font = "bold 30px monospace";
    ctx.strokeRect(canvas.width-100, canvas.height-40, 100, 40);
    ctx.fillText("Create", canvas.width-100, canvas.height);
    ctx.strokeRect(canvas.width-200, canvas.height-40, 100, 40);
    if (menu) {
        const gates = ["AND", "OR", "NOT", "LEVER", "BUFFER", "LASER"];
        let i = 0;
        for (const g of gates) {
            ctx.fillText(g, canvas.width-100, canvas.height-(i+1)*40);
            ctx.strokeRect(canvas.width-100, canvas.height-(i+2)*40, 100, 40);
            i += 1;
        }
    }
    ctx.fillText("Wire", canvas.width-200, canvas.height);
    ctx.strokeRect(canvas.width-300, canvas.height-40, 100, 40);
    ctx.fillText("Delete", canvas.width-300, canvas.height);
    ctx.strokeRect(canvas.width-400, canvas.height-40, 100, 40);
    ctx.fillText("Move", canvas.width-400, canvas.height);
}
function drawCursor(players) {
    for (const Tmouse of players) {
        ctx.fillStyle = "grey";
        ctx.beginPath();
        let screenmouse = Tmouse;
        ctx.arc(screenmouse.x, screenmouse.y, 5/Tmouse.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "bold 30px monospace";
        ctx.fillText(Tmouse.name, screenmouse.x-5/Tmouse.zoom, screenmouse.y-5/Tmouse.zoom);
    }
    ctx.fillStyle = "white";
    ctx.beginPath();
    let screenmouse = mouse
    ctx.arc(screenmouse.x, screenmouse.y, 5/camera.zoom, 0, Math.PI * 2);
    ctx.fill();
}
function drawGate(name, color, x, y, value) {
    ctx.font = "bold 30px monospace";
    if (name == "LASER" && value == 1) {
        ctx.strokeStyle = "red";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x+50, y+25);
        let the_one = (canvas.width-camera.x)/camera.zoom;
        for (const g of Object.values(world.gates)) {
            if (g.y < y+25 && y+25 < g.y+50) {
                if (g.x < the_one && g.x > x) {
                    the_one = Math.max(g.x, x+50);
                }
            }
        }
        ctx.lineTo(the_one, y+25);
        ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, 50, 50);
    ctx.fillStyle = color;
    ctx.fillText(name, x, y+50);
}
function drawWire(x1, y1, x2, y2, value) {
    ctx.strokeStyle = value===undefined ? "pink" : (value ? "white" : "grey");
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1+50, y1+25);
    ctx.lineTo(x2, y2+25);
    ctx.stroke();
}
const colors = {
    AND: "red",
    OR: "green",
    NOT: "blue"
}
const bicolors = {
    LEVER: ["grey", "white"],
    BUFFER: ["grey", "white"],
    LASER: ["grey", "white"]
}
function drawWorld() {
    for (const w of Object.values(world.wires)) {
        drawWire(world.gates[w._from].x, world.gates[w._from].y, world.gates[w._to].x, world.gates[w._to].y, world.gates[w._from].value);
    }
    for (const g of Object.values(world.gates)) {
        let col = colors[g.name];
        if (col === undefined) {
            col = bicolors[g.name][g.value];
        }
        drawGate(g.name, col, g.x, g.y, g.value)
    }
}
const keys = {};

window.addEventListener("keydown", e => {
    keys[e.key] = true;
});

window.addEventListener("keyup", e => {
    keys[e.key] = false;
});
function drawGrid(camera) {
    if (camera.zoom < 0.1) {
        return
    }
    const topleft = toWorld({x: 0, y: 0}, camera);
    const bottomright = toWorld({x: canvas.width, y: canvas.height}, camera);
    ctx.strokeStyle = "#202020";
    ctx.lineWidth = 1;
    for (let x = Math.floor(topleft.x/100)*100; x < Math.ceil(bottomright.x/100)*100; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, topleft.y);
        ctx.lineTo(x, bottomright.y);
        ctx.stroke();
    }
    for (let y = Math.floor(topleft.y/100)*100; y < Math.ceil(bottomright.y/100)*100; y += 100) {
        ctx.beginPath();
        ctx.moveTo(topleft.x, y);
        ctx.lineTo(bottomright.x, y);
        ctx.stroke();
    }
}
function getTouchPos(touch) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: touch.clientX-rect.left,
        y: touch.clientY-rect.top
    };
}
let evaluate = {
    AND(gate, inputs) {
        return +inputs.every(x => x == 1);
    },
    OR(gate, inputs) {
        return +inputs.some(x => x == 1);
    },
    BUFFER(gate, inputs) {
        return +inputs.some(x => x == 1);
    },
    LASER(gate, inputs) {
        return +inputs.some(x => x == 1);
    },
    NOT(gate, inputs) {
        return +!inputs.some(x => x == 1);
    },
    LEVER(gate, inputs) {
        return gate.enabled !== undefined ? gate.enabled : 0;
    },
};
let prevgates = {};
function gameloop() {
    if (host) {
        sendToHost(host, {
            type: "cursor",
            x: mouse.x,
            y: mouse.y,
            zoom: mouse.zoom
        })
    } else {
        needsUpdated = nextNeedsUpdated;
        nextNeedsUpdated = new Set();
        if (needsUpdated.size > 0) {
            prevgates = structuredClone(world.gates);
        }
        for (const g of needsUpdated) {
            let gate = world.gates[g];
            let inputs = [];
            for (const w of Object.keys(world.wires)) {
                let wire = world.wires[w];
                if (wire._to == g) {
                    inputs.push(prevgates[wire._from].value);
                }
                if (wire._from == g) {
                    nextNeedsUpdated.add(wire._to);
                }
            }
            gate.value = evaluate[gate.name](gate, inputs);
        }
        for (const conn of connections) {                
            let cursors = [mouse, ...players];
            cursors = cursors.filter(x => x.peer_id !== conn.peer);
            conn.send({
                type: "replication",
                players: cursors,
                state: world
            });
        }
    }
    let moved = false;
    if (keys["w"]) {
        camera.y += 10/camera.zoom;
        moved = true;
    }
    if (keys["s"]) {
        camera.y -= 10/camera.zoom;
        moved = true;
    }
    if (keys["a"]) {
        camera.x += 10/camera.zoom;
        moved = true;
    }
    if (keys["d"]) {
        camera.x -= 10/camera.zoom;
        moved = true;
    }
    if (moved) {
        mouseUpdate(smouse.x, smouse.y);
    }
    if (moving !== null) {
        if (moving in world.gates) {
            world.gates[moving].x = mouse.x;
            world.gates[moving].y = mouse.y;
        } else {
            moving = null;
            move_mode = false;
        }
    }
    if (Ctouches.length === 2 && Ptouches.length === 2) {
        const p1 = getTouchPos(Ptouches[0]);
        const p2 = getTouchPos(Ptouches[1]);
        const c1 = getTouchPos(Ctouches[0]);
        const c2 = getTouchPos(Ctouches[1]);

        const pmidScreen = {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };

        const cmidScreen = {
            x: (c1.x + c2.x) / 2,
            y: (c1.y + c2.y) / 2
        };

        const worldMid = toWorld(pmidScreen, camera);

        const pdis = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const cdis = Math.hypot(c2.x - c1.x, c2.y - c1.y);

        const zoomFactor = cdis / pdis;

        camera.zoom *= zoomFactor;

        // Put the same world point under the new finger midpoint
        camera.x = cmidScreen.x - worldMid.x * camera.zoom;
        camera.y = cmidScreen.y - worldMid.y * camera.zoom;
    }
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    drawGrid(camera);
    drawWorld();
    drawCursor(players);
    ctx.restore();
    drawUI();
    
    drawTest();
    requestAnimationFrame(gameloop);
}

canvas.addEventListener("mouseenter", () => {
    canvas.focus()
});
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext("2d");
    ctx.font = "bold 30px monospace";
    gl = post.getContext("webgl");
    post.width = window.innerWidth;
    post.height = window.innerHeight;
}
function clickHandle() {
    if (move_mode) {
        if (moving !== null) {
            sendToHost(host, {
                type: "movegate",
                id: moving,
                x: mouse.x,
                y: mouse.y
            });
            moving = null;
            move_mode = false;
            return
        }
    }
    const gate = getGateAt(mouse.x, mouse.y);
    if (gate === null) {
        return
    }
    if (wiring_mode) {
        if (wiring_from === null) {
            wiring_from = gate.id;
        } else if (wiring_to === null) {
            wiring_to = gate.id;
            wiring_mode = false;
            sendToHost(host, {
                type: "wiregates",
                _from: wiring_from,
                _to: wiring_to
            });
            wiring_from = null;
            wiring_to = null;
        }
    } else if (delete_mode) {
        delete_mode = false;
        sendToHost(host, {
            type: "deletegate",
            id: gate.id
        });
        
    } else if (move_mode) {
        if (moving === null) {
            moving = gate.id;
        }
    } else {
        if (gate === null) {
            return
        }
        sendToHost(host, {
            type: "clickgate",
            id: gate.id
        });
    }
}
window.addEventListener("resize", resize);
canvas.addEventListener("mousedown", e => {
    clickHandle();
});
function mouseUpdate(x, y) {
    smouse.x = x;
    smouse.y = y;
    mouse = toWorld({x: x, y: y}, camera);
    mouse.name = myname;
    mouse.zoom = camera.zoom;
    mouse.peer_id = getPeerId();
}
document.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseUpdate(x, y);
});
canvas.addEventListener("contextmenu", e => {
    e.preventDefault();
});
const input = document.getElementById("code");
const input2 = document.getElementById("name");
const enter = async e => {
    if (e.key === "Enter") {
        try {
            if (host) {
                sendToHost(host, {
                    type: "leave"
                })
            }
            let conn = await connectToPeer(peer, input.value)
            myname = input2.value;
            sendToHost(conn, {
                type: "join",
                name: myname
            })
            host = conn;
            // response handling
            host.on("data", data => {
                if (data.type == "replication") {
                    players = data.players
                    world = data.state
                }
            })
        } catch (error) {
            console.log(error)
        }
    }
}
input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        input2.focus()
    }
});
input2.addEventListener("keydown", enter);
canvas.addEventListener("wheel", e => {
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();

    // Mouse position on canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // World position before zoom
    const worldX = (mouseX - camera.x) / camera.zoom;
    const worldY = (mouseY - camera.y) / camera.zoom;

    // Change zoom
    const oldZoom = camera.zoom;

    if (e.deltaY < 0) {
        camera.zoom *= 1.1;
    } else {
        camera.zoom *= 0.9;
    }

    // Move camera so the mouse points at the same world position
    camera.x = mouseX - worldX * camera.zoom;
    camera.y = mouseY - worldY * camera.zoom;
    mouseUpdate(mouseX, mouseY);
}, { passive: false });
let primary = 0;
canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
        primary = e.touches[0].identifier;
    }
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
function touchMove(e) {
    for (const touch of e.touches) {
        if (touch.identifier === primary) {
            const pos = getTouchPos(touch);
            mouseUpdate(pos.x, pos.y);
        }
    }
}
canvas.addEventListener("touchmove", e => {
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
canvas.addEventListener("touchend", e => {
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
canvas.addEventListener("touchcancel", e => {
    Ptouches = Ctouches;
    Ctouches = [...e.touches];
});
resize();
canvas.focus()
