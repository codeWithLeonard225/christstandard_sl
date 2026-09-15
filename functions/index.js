// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.onAttendanceLogged = functions.firestore
  .document("AttendanceLogs/{logId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    const { studentID, schoolId, status, clockInTime } = data;

    // 1. Fetch token from PupilsReg collection
    const querySnapshot = await admin.firestore()
      .collection("PupilsReg")
      .where("studentID", "==", studentID)
      .where("schoolId", "==", schoolId)
      .get();

    if (querySnapshot.empty) return null;

    const fcmToken = querySnapshot.docs[0].data().fcmToken;
    if (!fcmToken) return null;

    // 2. Build payload
    const payload = {
      notification: {
        title: `Attendance Alert: ${data.studentName || 'Pupil'}`,
        body: `Status: ${status} | Time: ${clockInTime || 'N/A'}`
      },
      token: fcmToken
    };

    // 3. FCM sends or queues if offline
    return admin.messaging().send(payload);
  });