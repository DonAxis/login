// firebase.js
// Configuración de Firebase (versión compat)

const firebaseConfig = {
  apiKey: "AIzaSyDVgbGLLnL8plN1qatCoEXMS6jm5CD1rVc",
  authDomain: "registrosescolares9.firebaseapp.com",
  projectId: "registrosescolares9",
  storageBucket: "registrosescolares9.firebasestorage.app",
  messagingSenderId: "1094486519116",
  appId: "1:1094486519116:web:ca9ecd75c5d56dc7b6f3e9",
  measurementId: "G-HJ8YJG8V3W"
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
