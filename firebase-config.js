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
        role: userData.role || 'user'
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
      
      // Store user data in Firestore
      await setDoc(doc(this.db, COLLECTIONS.USERS, user.uid), {
        ...userData,
        email: email,
        role: userData.role || 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData,
          role: userData.role || 'user'
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
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      const user = userCredential.user;
      
      // Store user data in Firestore
      await setDoc(doc(this.db, COLLECTIONS.USERS, user.uid), {
        username: userData.username || email.split('@')[0],
        name: userData.name || '',
        email: email,
        role: userData.role || 'user',
        password: password, // Note: In production, don't store plain text password
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Also save to localStorage for backward compatibility
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const existingIndex = storedUsers.findIndex(u => u.username === userData.username);
      if (existingIndex >= 0) {
        storedUsers[existingIndex] = {
          ...storedUsers[existingIndex],
          name: userData.name,
          email: email,
          role: userData.role || 'user',
          uid: user.uid
        };
      } else {
        storedUsers.push({
          username: userData.username,
          password: password,
          name: userData.name,
          email: email,
          role: userData.role || 'user',
          uid: user.uid
        });
      }
      localStorage.setItem('msme_users', JSON.stringify(storedUsers));
      
      await this.addAuditLog('create', 'user', user.uid, { 
        username: userData.username,
        role: userData.role || 'user'
      });
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData,
          role: userData.role || 'user'
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

  async updateUserInFirebase(uid, updateData) {
    try {
      // Update user in Firestore
      const userRef = doc(this.db, COLLECTIONS.USERS, uid);
      await updateDoc(userRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      // Update in localStorage for backward compatibility
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const userIndex = storedUsers.findIndex(u => u.uid === uid);
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
      // Get user data before deleting
      const userDoc = await getDoc(doc(this.db, COLLECTIONS.USERS, uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      
      // Delete from Firestore
      await deleteDoc(doc(this.db, COLLECTIONS.USERS, uid));
      
      // Delete from localStorage
      const storedUsers = JSON.parse(localStorage.getItem('msme_users') || '[]');
      const filteredUsers = storedUsers.filter(u => u.uid !== uid);
      localStorage.setItem('msme_users', JSON.stringify(filteredUsers));
      
      // Note: To delete from Firebase Auth, you need Admin SDK
      // This will be handled server-side or through Firebase Console
      
      await this.addAuditLog('delete', 'user', uid, { username: userData?.username || 'Unknown' });
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
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

  // ============ LEGACY USER METHODS (Backward Compatibility) ============

  async getAllUsers() {
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
      console.error('Get users error:', error);
      return { success: false, error: error.message };
    }
  }

  async getUsers() {
    return this.getAllUsers();
  }

  async updateUser(uid, updateData) {
    try {
      const userRef = doc(this.db, COLLECTIONS.USERS, uid);
      await updateDoc(userRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      await this.addAuditLog('update', 'user', uid, updateData);
      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteUser(uid) {
    try {
      // Delete user document from Firestore
      await deleteDoc(doc(this.db, COLLECTIONS.USERS, uid));
      
      await this.addAuditLog('delete', 'user', uid, {});
      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============ PRODUCTIONS CRUD ============

  async addProduction(productionData) {
    try {
      // Calculate stockQty
      const data = {
        ...productionData,
        stockQty: (productionData.outputQty || 0) - (productionData.soldQty || 0),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(this.db, COLLECTIONS.PRODUCTIONS), data);
      
      // Log the action
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
      
      // Apply filters
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
      
      // Default ordering
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
      const docRef = doc(this.db, COLLECTIONS.PRODUCTIONS, id);
      
      // Recalculate stock if needed
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
      
      // Log the action
      await this.addAuditLog('update', 'production', id, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Update production error:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteProduction(id) {
    try {
      // Check if there are related sales
      const salesQuery = query(
        collection(this.db, COLLECTIONS.SALES),
        where('productionId', '==', id)
      );
      const salesSnapshot = await getDocs(salesQuery);
      
      // Delete related sales
      const batch = writeBatch(this.db);
      salesSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      // Delete the production
      batch.delete(doc(this.db, COLLECTIONS.PRODUCTIONS, id));
      
      await batch.commit();
      
      // Log the action
      await this.addAuditLog('delete', 'production', id, { 
        deletedSales: salesSnapshot.size 
      });
      
      return { success: true };
    } catch (error) {
      console.error('Delete production error:', error);
      return { success: false, error: error.message };
    }
  }

  // Real-time listener for productions
  listenProductions(callback, filters = {}) {
    let q = collection(this.db, COLLECTIONS.PRODUCTIONS);
    
    if (filters.prodName) {
      q = query(q, where('prodName', '==', filters.prodName));
    }
    
    // Default order by date
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
      
      // Log the action
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

  // IMPROVED: Delete sale with proper stock restoration
  async deleteSale(id) {
    try {
      // Get sale data first
      const sale = await this.getSale(id);
      if (!sale.success) {
        return { success: false, error: 'Sale not found' };
      }
      
      // If sale has saleLines, restore stock for each line
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
        // If no saleLines, use single productionId
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
      
      // Delete the sale
      await deleteDoc(doc(this.db, COLLECTIONS.SALES, id));
      
      // Log the action
      await this.addAuditLog('delete', 'sale', id, {});
      
      return { success: true };
    } catch (error) {
      console.error('Delete sale error:', error);
      return { success: false, error: error.message };
    }
  }

  // IMPROVED: Update sale with proper stock management
  async updateSale(id, updateData) {
    try {
      // Get current sale data
      const current = await this.getSale(id);
      if (!current.success) {
        return { success: false, error: 'Sale not found' };
      }
      
      const docRef = doc(this.db, COLLECTIONS.SALES, id);
      
      // If saleLines changed, restore old stock first
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
        // If no saleLines, restore from single production
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
      
      // Now apply new stock deduction from updateData
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
        // Apply new stock deduction
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
      
      // Update the sale document
      updateData.updatedAt = serverTimestamp();
      await updateDoc(docRef, updateData);
      
      // Log the action
      await this.addAuditLog('update', 'sale', id, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Update sale error:', error);
      return { success: false, error: error.message };
    }
  }

  // Listen to sales in real-time
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
      
      // Get unique products
      const uniqueProducts = [...new Set(productions.data.map(p => p.prodName))];
      
      // Stock analytics
      const stockMap = {};
      productions.data.forEach(p => {
        const name = p.prodName || 'Unnamed';
        if (!stockMap[name]) stockMap[name] = 0;
        stockMap[name] += (p.stockQty || 0);
      });
      
      const lowStock = Object.entries(stockMap)
        .filter(([_, stock]) => stock <= 5)
        .map(([name, stock]) => ({ name, stock }));
      
      // Product performance
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