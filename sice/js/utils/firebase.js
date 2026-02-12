// firebase.js
// Configuración de Firebase (versión compat)

const firebaseConfig = {
  apiKey: "AIzaSyBz6-XHbHOXvlHhiSTScY6d86ZK9m0ARq8",
  authDomain: "registrosescolares9-dev.firebaseapp.com",
  projectId: "registrosescolares9-dev",
  storageBucket: "registrosescolares9-dev.firebasestorage.app",
  messagingSenderId: "657373748694",
  appId: "1:657373748694:web:418360489f6fc66988d877",
  measurementId: "G-Y2R4KK8H39"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencia a Firestore
const db = firebase.firestore();

console.log('Firebase conectado correctamente');
