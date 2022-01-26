import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer";
import styled from "styled-components";

const Container = styled.div`
    padding: 20px;
    display: flex;
    height: 100vh;
    width: 90%;
    margin: auto;
    flex-wrap: wrap;
`;

const StyledVideo = styled.video`
    height: 20%;
    width: 30%;
`;

const Video = (props) => {
    const ref = useRef();

    useEffect(() => {
        props.peer.on("stream", stream => {
            ref.current.srcObject = stream;
        })
    }, []);

    return (
        <StyledVideo playsInline autoPlay ref={ref} />
    );
}

/**
 * ncaught Error: Connection failed.
 at h (index.js:17)
 at f.value (index.js:654)
 at RTCPeerConnection.t._pc.onconnectionstatechange (index.js:119)
 * @type {{width: number, height: number}}
 */

const videoConstraints = {
    // height: window.innerHeight / 2,
    // width: window.innerWidth / 2
    width: 320,
    height: 240,
    frameRate: { max: 10 }
};

const Room = (props) => {
    const [peers, setPeers] = useState([]);
    const socketRef = useRef();
    const userVideo = useRef();
    const peersRef = useRef([]);
    const roomID = props.match.params.roomID;

    useEffect(() => {
        socketRef.current = io.connect("/");
        navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true }).then(stream => {
            userVideo.current.srcObject = stream;
            socketRef.current.emit("join room", roomID);
            console.log('joined room')
            console.log('loop all users')

            socketRef.current.on("all users", users => {
                const peers = [];
                users.forEach(userID => {
                    const peer = createPeer(userID, socketRef.current.id, stream);
                    peersRef.current.push({
                        peerID: userID,
                        peer,
                    })
                    peers.push(peer);
                })
                setPeers(peers);
            })

            socketRef.current.on("user joined", payload => {
                console.log(payload)
                const peer = addPeer(payload.signal, payload.callerID, stream);
                peersRef.current.push({
                    peerID: payload.callerID,
                    peer,
                })

                setPeers(users => [...users, peer]);
            });

            socketRef.current.on("receiving returned signal", payload => {
                const item = peersRef.current.find(p => p.peerID === payload.id);
                item.peer.signal(payload.signal);
            });
        })
    }, []);

    function createPeer(userToSignal, callerID, stream) {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            config: {

                iceServers: [
                    {
                        urls: "stun:numb.viagenie.ca",
                        username: "nosystemanyone@gmail.com",
                        credential: "123456"
                    },
                    {
                        urls: "turn:numb.viagenie.ca",
                        username: "nosystemanyone@gmail.com",
                        credential: "123456"
                    }]
            },
            stream,
        });

        peer.on("signal", signal => {
            socketRef.current.emit("sending signal", { userToSignal, callerID, signal })
        })

        peer._pc.onconnectionstatechange = function () {

            if(peer._pc.connectionState === 'disconnected') {
                removePeer(peer)
            }
        }

        return peer;
    }

    function addPeer(incomingSignal, callerID, stream) {
        const peer = new Peer({
            initiator: false,
            trickle: false,
            config: {
                iceServers: [
                    {
                        urls: "stun:numb.viagenie.ca",
                        username: "nosystemanyone@gmail.com",
                        credential: "123456"
                    },
                    {
                        urls: "turn:numb.viagenie.ca",
                        username: "nosystemanyone@gmail.com",
                        credential: "123456"
                    }]
            },
            stream,
        })
        peer._pc.onconnectionstatechange = function () {
            console.log(peer._pc.iceConnectionState)
            if(peer._pc.connectionState === 'disconnected') {
                removePeer(peer)
            }
        }

        peer.on("signal", signal => {
            socketRef.current.emit("returning signal", { signal, callerID })
        })
        // peer.on("error", error => {
        //     if(error.code ==='ERR_DATA_CHANNEL') {
        //         peer.destroy()
        //     }
        // })

        peer.signal(incomingSignal);

        return peer;
    }

    function removePeer(peer){
        console.log(peers)
        setPeers(p => [...p].filter(i => i._id !== peer._id)
        );
    }

    return (
        <Container>
            <StyledVideo muted ref={userVideo} autoPlay playsInline />
            {peers.map((peer, index) => {
                if(peer.readable) {
                    return (
                        <Video key={index} peer={peer}/>
                    );
                }
            })}
        </Container>
    );
};

export default Room;
