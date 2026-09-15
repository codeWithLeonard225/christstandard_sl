// utils/messaging.js
import { getToken } from "firebase/messaging";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { db, messaging } from "../firebase";

export const requestDeviceToken = async (studentID, schoolId) => {
  try {
    if (!messaging) return;

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Get device FCM token
      const token = await getToken(messaging, {
        vapidKey: 'BG3m4EYuJ0F2lgQiWDgRn9UJA3-JZSJdyR0GQqkEtnbLUUiuhfbNIsT-WGwk158JJfNaoSV9snsGPH-uc7nWnfo'
      });

      if (token && studentID) {
        // Find pupil document and update fcmToken
        const q = query(
          collection(db, "PupilsReg"),
          where("studentID", "==", studentID),
          where("schoolId", "==", schoolId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          await updateDoc(docRef, { fcmToken: token });
        }
      }
    }
  } catch (error) {
    console.error("FCM Token Error:", error);
  }
};