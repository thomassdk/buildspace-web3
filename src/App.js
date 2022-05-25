import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import './App.css';
import abi from "./utils/WavePortal.json";
import SoundfontProvider from './SoundfontProvider';
import { Piano, KeyboardShortcuts, MidiNumbers } from '@fabb/react-piano';
import './piano.css'
import note from 'midi-note'

// webkitAudioContext fallback needed to support Safari
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundfontHostname = 'https://d1pzp51pvbm36p.cloudfront.net';

const contractAddress = "0x1214E571ce78B6FBDfe6Dc2159DA4FE4a0543599"
const contractABI = abi.abi;
const noteRange = {
  first: MidiNumbers.fromNote('c3'),
  last: MidiNumbers.fromNote('f4'),
};
const keyboardShortcuts = KeyboardShortcuts.create({
  firstNote: noteRange.first,
  lastNote: noteRange.last,
  keyboardConfig: KeyboardShortcuts.HOME_ROW,
});

export default function App() {
  /*
   * Just a state variable we use to store our user's public wallet.
   */
  const [currentAccount, setCurrentAccount] = useState("");
  const [allWaves, setAllWaves] = useState([]);
  const [waveContract, setWaveContract] = useState(null);

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
        await getAllWaves();
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
      await getAllWaves();
    } catch (error) {
      console.log(error)
    }
  }


  /*
   * Create a method that gets all waves from your contract
   */
  const getAllWaves = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const wavePortalContract = new ethers.Contract(contractAddress, contractABI, signer);

        setWaveContract(wavePortalContract);
        /*
         * Call the getAllWaves method from your Smart Contract
         */
        const waves = await wavePortalContract.getAllWaves();

        /*
         * We only need address, timestamp, and message in our UI so let's
         * pick those out
         */
        let wavesCleaned = [];
        waves.forEach(wave => {
          wavesCleaned.push({
            address: wave.waver,
            timestamp: new Date(wave.timestamp * 1000),
            message: wave.message
          });
        });

        /*
         * Store our data in React State
         */
        setAllWaves(wavesCleaned);
      } else {
        console.log("Ethereum object doesn't exist!")
      }
    } catch (error) {
      console.log(error);
    }
  }

  const wave = async (note) => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        let count = await waveContract.getTotalWaves();
        console.log("Retrieved total note count...", count.toNumber());

        /*
        * Execute the actual wave from your smart contract
        */
        const waveTxn = await waveContract.wave(note.toString());
        console.log("Mining...", waveTxn.hash);

        await waveTxn.wait();
        console.log("Mined -- ", waveTxn.hash);

        count = await waveContract.getTotalWaves();
        console.log("Retrieved total wave count...", count.toNumber());
      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
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
          <h1><span role="img">🕴️</span> Hey there <span role="img">🕴️</span></h1>
        </div>

        <div className="bio">
          I am William Buelow Gould and my name is a song that will be sung...
        </div>

        {currentAccount === "wallet-needed" &&
          <button className="connectButton" onClick={connectWallet}>
            Connect Wallet
          </button>
        }

        <p className="instructions">Send me a note <span role="img">🎶️</span> by playing the piano</p>

        <SoundfontProvider
          instrumentName="acoustic_grand_piano"
          audioContext={audioContext}
          hostname={soundfontHostname}
          render={({ isLoading, playNote, stopNote }) => (
            <Piano
              noteRange={noteRange}
              width={300}
              playNote={playNote}
              stopNote={(midi) => { wave(midi); stopNote(midi) }}
              disabled={isLoading}
              keyboardShortcuts={keyboardShortcuts}
            />
          )}
        />
        {allWaves.length ?
          <p className="total">{allWaves.length} note{allWaves.length > 1 ? "s" : ""} played!</p>
          : <span className="sax" role="img">🎷</span>}
        {allWaves.map((wave, index) => {
          return (
            <div key={index} className="waves" >
              <div>Address: {wave.address}</div>
              <div>Time: {wave.timestamp.toString()}</div>
              <div>Message: {note(wave.message)}</div>
            </div>)
        })}
      </div>
    </div>
  );
}
