import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import './App.css';
import abi from "./utils/NotePortal.json";
import SoundfontProvider from './SoundfontProvider';
import Soundfont from 'soundfont-player'
import { Piano, MidiNumbers } from '@fabb/react-piano';
import './piano.css'
import Abcjs from 'react-abcjs'
import { scientificToAbcNotation } from "@tonaljs/abc-notation";
import PlayIcon from './MaterialSymbolsPlayCircle';

// webkitAudioContext fallback needed to support Safari
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundfontHostname = 'https://d1pzp51pvbm36p.cloudfront.net';
const instrument = "acoustic_grand_piano";

function playName(notes) {
  //NOTE: Expand this so that the schedule is based on difference between different message timestamps?
  const schedule = notes.map((note, index) => ({ time: index * 0.5, note }))
  Soundfont.instrument(audioContext, instrument).then((piano) => {
    piano.schedule(audioContext.currentTime, schedule)
  })
}

const contractAddress = "0x0Ac0754D287C67cACD6B6C067db89243902C0654";
const contractABI = abi.abi;
const noteRange = {
  first: MidiNumbers.fromNote('c4'),
  last: MidiNumbers.fromNote('f5'),
};

export default function App() {
  /*
   * Just a state variable we use to store our user's public wallet.
   */
  const [currentAccount, setCurrentAccount] = useState("");
  const [allNotes, setAllNotes] = useState([]);
  const [noteContract, setNoteContract] = useState(null);
  const [writingToBlock, setWritingToBlock] = useState(false);

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        console.log("Make sure you have metamask!");
        return;
      } else {
        console.log("We have the ethereum object", ethereum);
      }

      /*
      * Check if we're authorized to access the user's wallet
      */
      const accounts = await ethereum.request({ method: "eth_accounts" });

      if (accounts.length !== 0) {
        const account = accounts[0];
        console.log("Found an authorized account:", account);
        setCurrentAccount(account)
        await getAllNotes();
      } else {
        console.log("No authorized account found")
        setCurrentAccount("wallet-needed")
      }
    } catch (error) {
      console.log(error);
    }
  }

  /**
 * Implement your connectWallet method here
 */
  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }

      const accounts = await ethereum.request({ method: "eth_requestAccounts" });

      console.log("Connected", accounts[0]);
      setCurrentAccount(accounts[0]);
      await getAllNotes();
    } catch (error) {
      console.log(error)
    }
  }


  /*
   * Create a method that gets all notes from your contract
   */
  const getAllNotes = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const notePortalContract = new ethers.Contract(contractAddress, contractABI, signer);

        setNoteContract(notePortalContract);
        /*
         * Call the getAllNotes method from your Smart Contract
         */
        const notes = await notePortalContract.getAllNotes();

        /*
         * We only need address, timestamp, and message in our UI so let's
         * pick those out
         */
        let notesCleaned = [];
        notes.forEach(note => {
          notesCleaned.push({
            address: note.player,
            timestamp: new Date(note.timestamp * 1000),
            note: note.note
          });
        });

        /*
         * Store our data in React State
         */
        setAllNotes(notesCleaned);
      } else {
        console.log("Ethereum object doesn't exist!")
      }
    } catch (error) {
      console.log(error);
    }
  }

  const note = async (note) => {
    try {
      const { ethereum } = window;
      setWritingToBlock(true);

      if (ethereum) {
        let count = await noteContract.getTotalNotes();
        console.log("Retrieved total note count...", count.toNumber());

        /*
        * Execute the actual note from your smart contract
        */
        const noteTxn = await noteContract.playNote(note.toString(), { gasLimit: 300000 });
        console.log("Mining...", noteTxn.hash);

        await noteTxn.wait();
        console.log("Mined -- ", noteTxn.hash);

        count = await noteContract.getTotalNotes();
        console.log("Retrieved total note count...", count.toNumber());

        await getAllNotes();
        setWritingToBlock(false);
      } else {
        console.log("Ethereum object doesn't exist!");
        setWritingToBlock(false);
      }
    } catch (error) {
      setWritingToBlock(false);
      console.log(error);
    }
  }

  useEffect(() => {
    checkIfWalletIsConnected();
  }, [])

  return (
    <div className="mainContainer">
      <div className="dataContainer">

        <div className="header">
          <h1><span role="img" aria-label="person in suit levitating">🕴️</span> Hey there <span role="img" aria-label="person in suit levitating">🕴️</span></h1>
        </div>

        <div className="bio">
          I am William Buelow Gould and my name is a song that will be sung...
        </div>

        {currentAccount === "wallet-needed" &&
          <button className="connectButton" onClick={connectWallet}>
            Connect Wallet
          </button>
        }

        <p className="instructions">Help me sing it <span role="img" aria-label="music notes">🎶️</span> by playing a note</p>
        <SoundfontProvider
          instrumentName={instrument}
          audioContext={audioContext}
          hostname={soundfontHostname}
          render={({ isLoading, playNote, stopNote }) => (
            <Piano
              noteRange={noteRange}
              width={500}
              playNote={playNote}
              stopNote={(midi) => { note(midi); stopNote(midi) }}
              disabled={isLoading || writingToBlock}
              renderNoteLabel={({ midiNumber }) => MidiNumbers.getAttributes(midiNumber).note}
            />
          )}
        />
        {allNotes.length ?
          <p className="total">
            {allNotes.length} note{allNotes.length > 1 && "s"} played!
            &nbsp;&nbsp;
            <PlayIcon
              className="playIcon"
              onClick={() => playName(allNotes.map(note => note.note))}
            />
          </p>
          : <span className="radio" role="img" aria-label="radio">📻</span>}

        <Abcjs
          abcNotation={
            `\nM:4/4\n ${allNotes
              .map(note => `${scientificToAbcNotation(MidiNumbers.getAttributes(note.note).note)}2`)
              .join(" ")}`
          }
          parserParams={{}}
          engraverParams={{ responsive: 'resize' }}
          renderParams={{ viewportHorizontal: true }}
        />

        {allNotes.map((note, index) => {
          const midiNote = MidiNumbers.getAttributes(note.note).note;
          const color = midiNote.includes("b") ? { background: "#555", font: "#f6f5f3" } : { background: "#f6f5f3", font: "#555" };
          return (
            <div key={index} className="notes" style={{ backgroundColor: color.background, color: color.font }}>
              <div>Player: {note.address}</div>
              <div>Time: {note.timestamp.toString()}</div>
              <div>Note: {midiNote}</div>
            </div>)
        })}
      </div>
    </div>
  );
}
