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

// Obtiene datos del usuario: primero del caché de sesión, si no de Firestore.
// Guarda en sessionStorage para evitar releer en cada cambio de página.
async function obtenerUsuarioConCache(uid) {
  try {
    const cached = sessionStorage.getItem('usuarioActual');
    if (cached) {
      const data = JSON.parse(cached);
      if (data.uid === uid) return data;
    }
  } catch(e) {}
  const doc = await db.collection('usuarios').doc(uid).get();
  if (!doc.exists) return null;
  const data = { uid, ...doc.data() };
  sessionStorage.setItem('usuarioActual', JSON.stringify(data));
  return data;
}
