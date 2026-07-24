// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js";

// 🔥 YOUR FIREBASE CONFIG - Copied from Firebase Console 🔥
const firebaseConfig = {
  apiKey: "AIzaSyCy2NYRKyFgdaH6eHGILdb-UadIoLZV7UU",
  authDomain: "msme-system.firebaseapp.com",
  projectId: "msme-system",
  storageBucket: "msme-system.firebasestorage.app",
  messagingSenderId: "949935027929",
  appId: "1:949935027929:web:571ae6ff6a25bffc7ab0c8",
  measurementId: "G-30LM6WKC8P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Collection References
const COLLECTIONS = {
  PRODUCTIONS: 'productions',
  SALES: 'sales',
  USERS: 'users',
  RAW_MATERIALS: 'rawMaterials',
  AUDIT_LOGS: 'auditLogs'
};

// Helper function to get number
function getNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// ============================================================
// FIREBASE SERVICE CLASS - Complete Backend Logic
// ============================================================

class FirebaseService {
  constructor() {
    this.db = db;
    this.auth = auth;
    this.storage = storage;
    this.listeners = [];
    this.currentUser = null;
    
    // Listen to auth state changes
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
    });
  }

  // ============ AUTHENTICATION METHODS ============
  
  async loginUser(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // Get user role from Firestore
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, user.uid));
      let userData = {};
      if (userDoc.exists()) {
        userData = userDoc.data();
      }
      
      const userInfo = {
        uid: user.uid,
        email: user.email,
        name: userData.name || user.email.split('@')[0],
        role: userData.role || 'user',
        status: userData.status || 'approved'
      };
      
      this.currentUser = userInfo;
      
      return {
        success: true,
        user: userInfo
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createUser(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // Store user data in Firestore with pending status
      await setDoc(doc(this.db, COLLECTIONS.USERS, user.uid), {
        ...userData,
        email: email,
        role: userData.role || 'user',
        status: 'pending', // pending, approved, rejected
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData,
          role: userData.role || 'user',
          status: 'pending'
        }
      };
    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logoutUser() {
    try {
      await signOut(this.auth);
      this.currentUser = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, callback);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async isAdmin() {
    if (!this.currentUser) return false;
    try {
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, this.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return data.role === 'admin';
      }
      return false;
    } catch (error) {
      console.error('Check admin error:', error);
      return false;
    }
  }

  async getUserRole(uid) {
    try {
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, uid));
      if (userDoc.exists()) {
        return {
          success: true,
          role: userDoc.data().role || 'user',
          status: userDoc.data().status || 'pending',
          data: userDoc.data()
        };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Get user role error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ USER MANAGEMENT WITH FIREBASE ============

  async createUserWithFirebase(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(this.db, COLLECTIONS.USERS, user.uid), {
        username: userData.username || email.split('@')[0],
        name: userData.name || '',
        email: email,
        role: userData.role || 'user',
        password: password, 
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const existingIndex = storedUsers.findIndex(u => u.username === userData.username);
      if (existingIndex >= 0) {
        storedUsers[existingIndex] = {
          ...storedUsers[existingIndex],
          name: userData.name,
          email: email,
          role: userData.role || 'user',
          uid: user.uid,
          status: 'pending'
        };
      } else {
        storedUsers.push({
          username: userData.username,
          password: password,
          name: userData.name,
          email: email,
          role: userData.role || 'user',
          uid: user.uid,
          status: 'pending'
        });
      }
      localStorage.setItem('msme_users', JSON.stringify(storedUsers));
      
      await this.addAuditLog('create', 'user', user.uid, { 
        username: userData.username,
        role: userData.role || 'user',
        status: 'pending'
      });
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData,
          role: userData.role || 'user',
          status: 'pending'
        }
      };
    } catch (error) {
      console.error('Create user with Firebase error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============ USER APPROVAL METHODS ============

  async createUserWithApproval(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      await setDoc(doc(this.db, COLLECTIONS.USERS, user.uid), {
        username: userData.username || email.split('@')[0],
        name: userData.name || '',
        email: email,
        role: userData.role || 'user',
        password: password,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      storedUsers.push({
        username: userData.username,
        password: password,
        name: userData.name,
        email: email,
        role: userData.role || 'user',
        uid: user.uid,
        status: 'pending'
      });
      localStorage.setItem('msme_users', JSON.stringify(storedUsers));
      
      await this.addAuditLog('create', 'user', user.uid, { 
        username: userData.username,
        role: userData.role || 'user',
        status: 'pending'
      });
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData,
          role: userData.role || 'user',
          status: 'pending'
        }
      };
    } catch (error) {
      console.error('Create user with approval error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async approveUser(uid) {
    try {
      const userRef = doc(this.db, COLLECTIONS.USERS, uid);
      await updateDoc(userRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: this.auth.currentUser?.uid || 'system',
        updatedAt: serverTimestamp()
      });
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const userIndex = storedUsers.findIndex(u => u.uid === uid || u.id === uid);
      if (userIndex >= 0) {
        storedUsers[userIndex].status = 'approved';
        localStorage.setItem('msme_users', JSON.stringify(storedUsers));
      }
      
      await this.addAuditLog('approve', 'user', uid, { status: 'approved' });
      return { success: true };
    } catch (error) {
      console.error('Approve user error:', error);
      return { success: false, error: error.message };
    }
  }

  async rejectUser(uid) {
    try {
      const userRef = doc(this.db, COLLECTIONS.USERS, uid);
      await updateDoc(userRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: this.auth.currentUser?.uid || 'system',
        updatedAt: serverTimestamp()
      });
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const userIndex = storedUsers.findIndex(u => u.uid === uid || u.id === uid);
      if (userIndex >= 0) {
        storedUsers[userIndex].status = 'rejected';
        localStorage.setItem('msme_users', JSON.stringify(storedUsers));
      }
      
      await this.addAuditLog('reject', 'user', uid, { status: 'rejected' });
      return { success: true };
    } catch (error) {
      console.error('Reject user error:', error);
      return { success: false, error: error.message };
    }
  }

  async getPendingUsers() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.USERS),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      return { success: true, data: users };
    } catch (error) {
      console.error('Get pending users error:', error);
      return { success: false, error: error.message };
    }
  }

  async getApprovedUsers() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.USERS),
        where('status', '==', 'approved')
      );
      const querySnapshot = await getDocs(q);
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      return { success: true, data: users };
    } catch (error) {
      console.error('Get approved users error:', error);
      return { success: false, error: error.message };
    }
  }

  async getRejectedUsers() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.USERS),
        where('status', '==', 'rejected')
      );
      const querySnapshot = await getDocs(q);
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      return { success: true, data: users };
    } catch (error) {
      console.error('Get rejected users error:', error);
      return { success: false, error: error.message };
    }
  }

  async checkUserStatus(uid) {
    try {
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          success: true,
          status: data.status || 'pending',
          data: data
        };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      console.error('Check user status error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ LEGACY USER METHODS (Backward Compatibility) ============

  async updateUserInFirebase(uid, updateData) {
    try {
      const userRef = doc(this.db, COLLECTIONS.USERS, uid);
      await updateDoc(userRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const userIndex = storedUsers.findIndex(u => u.uid === uid || u.id === uid);
      if (userIndex >= 0) {
        storedUsers[userIndex] = {
          ...storedUsers[userIndex],
          ...updateData
        };
        localStorage.setItem('msme_users', JSON.stringify(storedUsers));
      }
      
      await this.addAuditLog('update', 'user', uid, updateData);
      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteUserFromFirebase(uid) {
    try {
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      await deleteDoc(doc(this.db, COLLECTIONS.USERS, uid));
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const filteredUsers = storedUsers.filter(u => u.uid !== uid && u.id !== uid);
      localStorage.setItem('msme_users', JSON.stringify(filteredUsers));
      
      await this.addAuditLog('delete', 'user', uid, { username: userData?.username || 'Unknown' });
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, error: error.message };
    }
  }

  // Complete user removal and dashboard access revocation
  async deleteUserCompletely(uid) {
    try {
      const userRef = doc(this.db, COLLECTIONS.USERS, uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          status: 'deleted',
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await deleteDoc(userRef);
      }
      
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const filteredUsers = storedUsers.filter(u => u.uid !== uid && u.id !== uid && u.username !== uid);
      localStorage.setItem('msme_users', JSON.stringify(filteredUsers));
      
      await this.addAuditLog('delete', 'user', uid, { action: 'complete_user_removal' });
      return { success: true };
    } catch (error) {
      console.error('Delete user completely error:', error);
      return { success: false, error: error.message };
    }
  }

  async getUsersFromFirebase() {
    try {
      const querySnapshot = await getDocs(collection(this.db, COLLECTIONS.USERS));
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data()
        });
      });
      return { success: true, data: users };
    } catch (error) {
      console.error('Get users from Firebase error:', error);
      return { success: false, error: error.message };
    }
  }

  async getAllUsers() {
    return this.getUsersFromFirebase();
  }

  async getUsers() {
    return this.getAllUsers();
  }

  async updateUser(uid, updateData) {
    return this.updateUserInFirebase(uid, updateData);
  }

  async deleteUser(uid) {
    return this.deleteUserCompletely(uid);
  }

  // ============ PRODUCTIONS CRUD ============

  async addProduction(productionData) {
    try {
      let imageUrl = null;
      
      if (productionData.imageFile && productionData.imageFile instanceof File) {
        try {
          const filePath = `products/${Date.now()}_${productionData.imageFile.name}`;
          const fileRef = ref(this.storage, filePath);
          const snapshot = await uploadBytes(fileRef, productionData.imageFile);
          imageUrl = await getDownloadURL(snapshot.ref);
        } catch (storageError) {
          console.error("Storage upload failed, saving without image:", storageError);
        }
      }
      
      delete productionData.imageFile;
      
      const data = {
        ...productionData,
        imageUrl: imageUrl || productionData.imageUrl || null,
        stockQty: (productionData.outputQty || 0) - (productionData.soldQty || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(this.db, COLLECTIONS.PRODUCTIONS), data);
      await this.addAuditLog('create', 'production', docRef.id, data);
      
      return {
        success: true,
        id: docRef.id,
        data: { ...data, id: docRef.id }
      };
    } catch (error) {
      console.error('Add production error:', error);
      return { success: false, error: error.message };
    }
  }

  async getProductions(filters = {}) {
    try {
      let q = collection(this.db, COLLECTIONS.PRODUCTIONS);
      
      if (filters.prodName) {
        q = query(q, where('prodName', '==', filters.prodName));
      }
      
      if (filters.batchId) {
        q = query(q, where('batchId', '==', filters.batchId));
      }
      
      if (filters.startDate && filters.endDate) {
        q = query(q, 
          where('prodDate', '>=', filters.startDate),
          where('prodDate', '<=', filters.endDate)
        );
      }
      
      q = query(q, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const productions = [];
      
      querySnapshot.forEach((doc) => {
        productions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        data: productions
      };
    } catch (error) {
      console.error('Get productions error:', error);
      return { success: false, error: error.message };
    }
  }

  async getProduction(id) {
    try {
      const docRef = doc(this.db, COLLECTIONS.PRODUCTIONS, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: { id: docSnap.id, ...docSnap.data() }
        };
      } else {
        return { success: false, error: 'Production not found' };
      }
    } catch (error) {
      console.error('Get production error:', error);
      return { success: false, error: error.message };
    }
  }

  async updateProduction(id, updateData) {
    try {
      let imageUrl = updateData.imageUrl;
      
      if (updateData.imageFile && updateData.imageFile instanceof File) {
        try {
          const filePath = `products/${Date.now()}_${updateData.imageFile.name}`;
          const fileRef = ref(this.storage, filePath);
          const snapshot = await uploadBytes(fileRef, updateData.imageFile);
          imageUrl = await getDownloadURL(snapshot.ref);
        } catch (storageError) {
          console.error("Storage upload failed during update:", storageError);
        }
      }
      
      delete updateData.imageFile;
      if (imageUrl) {
        updateData.imageUrl = imageUrl;
      }

      const docRef = doc(this.db, COLLECTIONS.PRODUCTIONS, id);
      
      if (updateData.outputQty !== undefined || updateData.soldQty !== undefined) {
        const current = await this.getProduction(id);
        if (current.success) {
          const outputQty = updateData.outputQty !== undefined ? updateData.outputQty : current.data.outputQty;
          const soldQty = updateData.soldQty !== undefined ? updateData.soldQty : current.data.soldQty;
          updateData.stockQty = (outputQty || 0) - (soldQty || 0);
        }
      }
      
      updateData.updatedAt = serverTimestamp();
      
      await updateDoc(docRef, updateData);
      await this.addAuditLog('update', 'production', id, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Update production error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteProduction(id) {
    try {
      const salesQuery = query(
        collection(this.db, COLLECTIONS.SALES),
        where('productionId', '==', id)
      );
      const salesSnapshot = await getDocs(salesQuery);
      
      const batch = writeBatch(this.db);
      salesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      batch.delete(doc(this.db, COLLECTIONS.PRODUCTIONS, id));
      
      await batch.commit();
      await this.addAuditLog('delete', 'production', id, { 
        deletedSales: salesSnapshot.size 
      });
      
      return { success: true };
    } catch (error) {
      console.error('Delete production error:', error);
      return { success: false, error: error.message };
    }
  }

  listenProductions(callback, filters = {}) {
    let q = collection(this.db, COLLECTIONS.PRODUCTIONS);
    
    if (filters.prodName) {
      q = query(q, where('prodName', '==', filters.prodName));
    }
    
    q = query(q, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productions = [];
      snapshot.forEach((doc) => {
        productions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(productions);
    }, (error) => {
      console.error('Listen productions error:', error);
    });
    
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  // ============ SALES CRUD WITH IMPROVED STOCK MANAGEMENT ============

  async addSale(saleData) {
    try {
      const data = {
        ...saleData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(this.db, COLLECTIONS.SALES), data);
      await this.addAuditLog('create', 'sale', docRef.id, data);
      
      return {
        success: true,
        id: docRef.id,
        data: { ...data, id: docRef.id }
      };
    } catch (error) {
      console.error('Add sale error:', error);
      return { success: false, error: error.message };
    }
  }

  async getSales(filters = {}) {
    try {
      let q = collection(this.db, COLLECTIONS.SALES);
      
      if (filters.productionId) {
        q = query(q, where('productionId', '==', filters.productionId));
      }
      
      if (filters.startDate && filters.endDate) {
        q = query(q, 
          where('saleDate', '>=', filters.startDate),
          where('saleDate', '<=', filters.endDate)
        );
      }
      
      q = query(q, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const sales = [];
      
      querySnapshot.forEach((doc) => {
        sales.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        data: sales
      };
    } catch (error) {
      console.error('Get sales error:', error);
      return { success: false, error: error.message };
    }
  }

  async getSale(id) {
    try {
      const docRef = doc(this.db, COLLECTIONS.SALES, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: { id: docSnap.id, ...docSnap.data() }
        };
      } else {
        return { success: false, error: 'Sale not found' };
      }
    } catch (error) {
      console.error('Get sale error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteSale(id) {
    try {
      const sale = await this.getSale(id);
      if (!sale.success) {
        return { success: false, error: 'Sale not found' };
      }
      
      if (sale.data.saleLines && Array.isArray(sale.data.saleLines) && sale.data.saleLines.length > 0) {
        for (const line of sale.data.saleLines) {
          const production = await this.getProduction(line.productionId);
          if (production.success) {
            const prod = production.data;
            const currentStock = getNumber(prod.stockQty);
            const currentSold = getNumber(prod.soldQty);
            const qtyToRestore = getNumber(line.qty);
            
            const newStock = currentStock + qtyToRestore;
            const newSold = Math.max(0, currentSold - qtyToRestore);
            
            await this.updateProduction(line.productionId, {
              stockQty: newStock,
              soldQty: newSold
            });
          }
        }
      } else if (sale.data.productionId && sale.data.saleQty) {
        const production = await this.getProduction(sale.data.productionId);
        if (production.success) {
          const prod = production.data;
          const currentStock = getNumber(prod.stockQty);
          const currentSold = getNumber(prod.soldQty);
          const qtyToRestore = getNumber(sale.data.saleQty);
          
          const newStock = currentStock + qtyToRestore;
          const newSold = Math.max(0, currentSold - qtyToRestore);
          
          await this.updateProduction(sale.data.productionId, {
            stockQty: newStock,
            soldQty: newSold
          });
        }
      }
      
      await deleteDoc(doc(this.db, COLLECTIONS.SALES, id));
      await this.addAuditLog('delete', 'sale', id, {});
      
      return { success: true };
    } catch (error) {
      console.error('Delete sale error:', error);
      return { success: false, error: error.message };
    }
  }

  async updateSale(id, updateData) {
    try {
      const current = await this.getSale(id);
      if (!current.success) {
        return { success: false, error: 'Sale not found' };
      }
      
      const docRef = doc(this.db, COLLECTIONS.SALES, id);
      
      if (current.data.saleLines && Array.isArray(current.data.saleLines) && current.data.saleLines.length > 0) {
        for (const line of current.data.saleLines) {
          const production = await this.getProduction(line.productionId);
          if (production.success) {
            const prod = production.data;
            const currentStock = getNumber(prod.stockQty);
            const currentSold = getNumber(prod.soldQty);
            const qtyToRestore = getNumber(line.qty);
            
            const newStock = currentStock + qtyToRestore;
            const newSold = Math.max(0, currentSold - qtyToRestore);
            
            await this.updateProduction(line.productionId, {
              stockQty: newStock,
              soldQty: newSold
            });
          }
        }
      } else if (current.data.productionId && current.data.saleQty) {
        const production = await this.getProduction(current.data.productionId);
        if (production.success) {
          const prod = production.data;
          const currentStock = getNumber(prod.stockQty);
          const currentSold = getNumber(prod.soldQty);
          const qtyToRestore = getNumber(current.data.saleQty);
          
          const newStock = currentStock + qtyToRestore;
          const newSold = Math.max(0, currentSold - qtyToRestore);
          
          await this.updateProduction(current.data.productionId, {
            stockQty: newStock,
            soldQty: newSold
          });
        }
      }
      
      if (updateData.saleLines && Array.isArray(updateData.saleLines) && updateData.saleLines.length > 0) {
        for (const line of updateData.saleLines) {
          const production = await this.getProduction(line.productionId);
          if (production.success) {
            const prod = production.data;
            const currentStock = getNumber(prod.stockQty);
            const currentSold = getNumber(prod.soldQty);
            const qtyToDeduct = getNumber(line.qty);
            
            if (currentStock < qtyToDeduct) {
              return { success: false, error: 'Insufficient stock for update' };
            }
            
            const newStock = currentStock - qtyToDeduct;
            const newSold = currentSold + qtyToDeduct;
            
            await this.updateProduction(line.productionId, {
              stockQty: newStock,
              soldQty: newSold
            });
          }
        }
      } else if (updateData.productionId && updateData.saleQty) {
        const production = await this.getProduction(updateData.productionId);
        if (production.success) {
          const prod = production.data;
          const currentStock = getNumber(prod.stockQty);
          const currentSold = getNumber(prod.soldQty);
          const qtyToDeduct = getNumber(updateData.saleQty);
          
          if (currentStock < qtyToDeduct) {
            return { success: false, error: 'Insufficient stock for update' };
          }
          
          const newStock = currentStock - qtyToDeduct;
          const newSold = currentSold + qtyToDeduct;
          
          await this.updateProduction(updateData.productionId, {
            stockQty: newStock,
            soldQty: newSold
          });
        }
      }
      
      updateData.updatedAt = serverTimestamp();
      await updateDoc(docRef, updateData);
      await this.addAuditLog('update', 'sale', id, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Update sale error:', error);
      return { success: false, error: error.message };
    }
  }

  listenSales(callback, filters = {}) {
    let q = collection(this.db, COLLECTIONS.SALES);
    
    if (filters.productionId) {
      q = query(q, where('productionId', '==', filters.productionId));
    }
    
    q = query(q, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sales = [];
      snapshot.forEach((doc) => {
        sales.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(sales);
    }, (error) => {
      console.error('Listen sales error:', error);
    });
    
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  // ============ STOCK MANAGEMENT ============

  async updateProductionStock(productionId, quantityChange) {
    try {
      const production = await this.getProduction(productionId);
      if (!production.success) {
        return { success: false, error: 'Production not found' };
      }
      
      const newStock = (production.data.stockQty || 0) + quantityChange;
      if (newStock < 0) {
        return { success: false, error: 'Insufficient stock' };
      }
      
      await this.updateProduction(productionId, {
        stockQty: newStock,
        soldQty: (production.data.soldQty || 0) + (quantityChange < 0 ? -quantityChange : 0)
      });
      
      return { success: true };
    } catch (error) {
      console.error('Update stock error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ AUDIT LOGS ============

  async addAuditLog(action, collectionName, documentId, data) {
    try {
      await addDoc(collection(this.db, COLLECTIONS.AUDIT_LOGS), {
        action,
        collection: collectionName,
        documentId,
        data,
        timestamp: serverTimestamp(),
        user: this.auth.currentUser?.uid || 'system'
      });
    } catch (error) {
      console.error('Add audit log error:', error);
    }
  }

  // ============ ANALYTICS & REPORTS ============

  async getAnalytics(filters = {}) {
    try {
      const productions = await this.getProductions(filters);
      const sales = await this.getSales(filters);
      
      if (!productions.success || !sales.success) {
        return { success: false, error: 'Failed to fetch data' };
      }
      
      const totalBatches = productions.data.length;
      const totalUnits = productions.data.reduce((sum, p) => sum + (p.outputQty || 0), 0);
      const totalSold = sales.data.reduce((sum, s) => sum + (s.saleQty || 0), 0);
      const totalProfit = productions.data.reduce((sum, p) => sum + (p.profit || 0), 0);
      const totalSalesRevenue = sales.data.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalRawCost = productions.data.reduce((sum, p) => sum + (p.rawCost || 0), 0);
      
      const uniqueProducts = [...new Set(productions.data.map(p => p.prodName))];
      
      const stockMap = {};
      productions.data.forEach(p => {
        const name = p.prodName || 'Unnamed';
        if (!stockMap[name]) stockMap[name] = 0;
        stockMap[name] += (p.stockQty || 0);
      });
      
      const lowStock = Object.entries(stockMap)
        .filter(([_, stock]) => stock <= 5)
        .map(([name, stock]) => ({ name, stock }));
      
      const productPerformance = {};
      productions.data.forEach(p => {
        const name = p.prodName || 'Unnamed';
        if (!productPerformance[name]) {
          productPerformance[name] = { totalProfit: 0, totalUnits: 0, totalCost: 0 };
        }
        productPerformance[name].totalProfit += (p.profit || 0);
        productPerformance[name].totalUnits += (p.outputQty || 0);
        productPerformance[name].totalCost += (p.rawCost || 0);
      });
      
      return {
        success: true,
        data: {
          totalBatches,
          totalUnits,
          totalSold,
          totalProfit,
          totalSalesRevenue,
          totalRawCost,
          uniqueProducts: uniqueProducts.length,
          lowStock,
          productPerformance,
          stockMap
        }
      };
    } catch (error) {
      console.error('Get analytics error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ DATA IMPORT/EXPORT ============

  async exportAllData() {
    try {
      const productions = await this.getProductions();
      const sales = await this.getSales();
      const users = await this.getAllUsers();
      
      return {
        success: true,
        data: {
          productions: productions.data,
          sales: sales.data,
          users: users.data,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Export data error:', error);
      return { success: false, error: error.message };
    }
  }

  async importProductions(productionsData) {
    try {
      const batch = writeBatch(this.db);
      
      productionsData.forEach((data) => {
        const docRef = doc(collection(this.db, COLLECTIONS.PRODUCTIONS));
        batch.set(docRef, {
          ...data,
          importedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      
      return { success: true };
    } catch (error) {
      console.error('Import data error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ CLEANUP ============

  detachAllListeners() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();

// Export for use in other files  
export { 
  firebaseService,
  db,
  auth,
  storage,
  COLLECTIONS
};