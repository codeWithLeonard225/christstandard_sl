
import React, { useState, useEffect, useMemo } from "react";
import CameraCapture from "../CaptureCamera/CameraCapture";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  onSnapshot,
  getDocs,
  where,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";

// Cloudinary config
const CLOUD_NAME = "doucdnzij";
const UPLOAD_PRESET = "Nardone";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ADMIN_PASSWORD = "1234";

// School classes
const SCHOOL_CLASSES = [
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

// Teacher positions
const DEFAULT_POSITIONS = [
  "Principal",
  "Vice Principal",
  "Head Teacher",
  "Assistant Head Teacher",
  "Teacher",
  "Secretary",
  "Accountant",
];

const TeacherRegistration = () => {
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  const initialFormState = {
    id: null,
    teacherID: uuidv4().slice(0, 8),
    teacherName: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    position: "",
    registrationDate: new Date().toISOString().slice(0, 10),
    registeredBy: "",
    userPhoto: null,
    userPublicId: null,
    schoolId: schoolId,
    isFormMaster: false,
    formMasterClass: "",
    teacherCategory: "",
    salary: "",
    academicStartDate: new Date().toISOString().slice(0, 10),
    lateCostPerDay: "",
    absentCostPerDay: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [teachers, setTeachers] = useState([]);

  // Position states
  const [positions, setPositions] = useState(DEFAULT_POSITIONS);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [newPosition, setNewPosition] = useState("");

  // Add a new position
  const handleAddPosition = () => {
    const position = newPosition.trim();

    if (!position) {
      toast.error("Please enter a position.");
      return;
    }

    if (
      positions.some(
        (item) => item.toLowerCase() === position.toLowerCase()
      )
    ) {
      toast.error("This position already exists.");
      return;
    }

    setPositions((prev) => [...prev, position]);

    // Automatically select the new position
    setFormData((prev) => ({
      ...prev,
      position: position,
    }));

    setNewPosition("");
    setShowPositionModal(false);

    toast.success("Position added successfully!");
  };

  // Real-time listener for Teachers collection
  useEffect(() => {
    const collectionRef = collection(db, "Teachers");
    const q = query(collectionRef, where("schoolId", "==", schoolId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const teacherList = snapshot.docs.map((teacherDoc) => ({
          id: teacherDoc.id,
          ...teacherDoc.data(),
        }));

        setTeachers(teacherList);
      },
      (error) => {
        console.error("Firestore Teachers onSnapshot failed:", error);
        toast.error("Failed to load teacher data.");
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  // Filter teachers by name or ID
  const filteredTeachers = useMemo(() => {
    if (!searchTerm.trim()) return teachers;

    const lower = searchTerm.toLowerCase();

    return teachers.filter(
      (teacher) =>
        teacher.teacherName?.toLowerCase().includes(lower) ||
        teacher.teacherID?.toLowerCase().includes(lower)
    );
  }, [teachers, searchTerm]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "isFormMaster" && !checked
        ? { formMasterClass: "" }
        : {}),
    }));
  };

  // Handle upload success
  const handleUploadSuccess = (url, publicId) => {
    setFormData((prev) => ({
      ...prev,
      userPhoto: url,
      userPublicId: publicId,
    }));

    toast.success("Photo uploaded successfully!");
  };

  // Handle camera capture
  const handleCameraCapture = async (base64Data) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const res = await fetch(base64Data);
      const blob = await res.blob();

      if (blob.size > MAX_FILE_SIZE) {
        toast.error("Image too large (Max 5MB)");
        return;
      }

      const formDataObj = new FormData();

      formDataObj.append("file", blob);
      formDataObj.append("upload_preset", UPLOAD_PRESET);
      formDataObj.append("folder", "Christ_standard/Teachers");

      const resUpload = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formDataObj,
        }
      );

      if (!resUpload.ok) {
        throw new Error("Cloudinary upload failed");
      }

      const data = await resUpload.json();

      handleUploadSuccess(data.secure_url, data.public_id);
    } catch (err) {
      console.error("Camera upload failed:", err);
      toast.error("Failed to upload image.");
    } finally {
      setIsUploading(false);
      setShowCamera(false);
    }
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.teacherName.trim()) {
      toast.error("Teacher name is required.");
      return;
    }

    if (formData.isFormMaster && !formData.formMasterClass) {
      toast.error("Please assign a class for the Form Master.");
      return;
    }

    setIsSubmitting(true);

    const oldTeacherName = teachers.find(
      (teacher) => teacher.id === formData.id
    )?.teacherName;

    try {
      const newTeacherName = formData.teacherName.trim().toUpperCase();

      const teacherData = {
        teacherID: formData.teacherID,
        teacherName: newTeacherName,
        gender: formData.gender,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        position: formData.position,
        registrationDate: formData.registrationDate,
        registeredBy: formData.registeredBy,
        userPhotoUrl: formData.userPhoto,
        userPublicId: formData.userPublicId,
        schoolId: formData.schoolId,

        isFormMaster: formData.isFormMaster,
        formMasterClass: formData.isFormMaster
          ? formData.formMasterClass
          : "",
        teacherCategory: formData.teacherCategory,
        salary: formData.salary ? parseFloat(formData.salary) : 0,

        academicStartDate: formData.academicStartDate || null,
        lateCostPerDay: formData.lateCostPerDay
          ? Number(formData.lateCostPerDay)
          : 0,
        absentCostPerDay: formData.absentCostPerDay
          ? Number(formData.absentCostPerDay)
          : 0,
      };

      if (formData.id) {
        // Update teacher
        const teacherRef = doc(db, "Teachers", formData.id);

        await updateDoc(teacherRef, teacherData);

        // Update TeacherAssignments if teacher name changed
        if (oldTeacherName && oldTeacherName !== newTeacherName) {
          const assignmentsQuery = query(
            collection(db, "TeacherAssignments"),
            where("teacher", "==", oldTeacherName),
            where("schoolId", "==", schoolId)
          );

          const snapshot = await getDocs(assignmentsQuery);

          const updatePromises = snapshot.docs.map((assignmentDoc) => {
            const assignmentRef = doc(
              db,
              "TeacherAssignments",
              assignmentDoc.id
            );

            return updateDoc(assignmentRef, {
              teacher: newTeacherName,
            });
          });

          await Promise.all(updatePromises);

          toast.success(
            `Teacher and ${updatePromises.length} assignment(s) updated successfully!`
          );
        } else {
          toast.success("Teacher updated successfully!");
        }
      } else {
        // Register new teacher
        await addDoc(collection(db, "Teachers"), {
          ...teacherData,
          timestamp: new Date(),
        });

        toast.success("Teacher registered successfully!");
      }

      // Reset form
      setFormData({
        ...initialFormState,
        teacherID: uuidv4().slice(0, 8),
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save teacher data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit existing teacher
  const handleUpdate = (teacher) => {
    setFormData({
      id: teacher.id,
      teacherID: teacher.teacherID,
      teacherName: teacher.teacherName,
      gender: teacher.gender || "",
      phone: teacher.phone || "",
      email: teacher.email || "",
      address: teacher.address || "",
      position: teacher.position || "",
      registrationDate:
        teacher.registrationDate ||
        new Date().toISOString().slice(0, 10),
      registeredBy: teacher.registeredBy || "",
      userPhoto: teacher.userPhotoUrl || null,
      userPublicId: teacher.userPublicId || null,
      schoolId: teacher.schoolId || schoolId,
      isFormMaster: teacher.isFormMaster || false,
      formMasterClass: teacher.formMasterClass || "",
      teacherCategory: teacher.teacherCategory || "",
      salary: teacher.salary || "",
      academicStartDate:
        teacher.academicStartDate ||
        new Date().toISOString().slice(0, 10),
      lateCostPerDay: teacher.lateCostPerDay ?? "",
      absentCostPerDay: teacher.absentCostPerDay ?? "",
    });

    // Add saved position if it is not already in the list
    if (
      teacher.position &&
      !positions.some(
        (item) => item.toLowerCase() === teacher.position.toLowerCase()
      )
    ) {
      setPositions((prev) => [...prev, teacher.position]);
    }

    toast.info(`Editing teacher: ${teacher.teacherName}`);
  };

  // Delete teacher
  const handleDelete = async (id, teacherName) => {
    const password = window.prompt("Enter admin password to delete:");

    if (password === ADMIN_PASSWORD) {
      if (window.confirm(`Delete teacher: ${teacherName}?`)) {
        try {
          await deleteDoc(doc(db, "Teachers", id));
          toast.success("Teacher deleted successfully!");
        } catch (err) {
          console.error(err);
          toast.error("Failed to delete teacher.");
        }
      }
    } else if (password !== null) {
      toast.error("Incorrect password.");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
      {/* FORM */}
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl"
      >
        <h2 className="text-2xl font-bold text-center mb-4">
          {formData.id ? "Update Teacher" : "Teacher Registration"}
        </h2>

        {/* Teacher ID and Name */}
        <div className="flex flex-col md:flex-row md:space-x-4">
          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Teacher ID
            </label>

            <input
              type="text"
              name="teacherID"
              value={formData.teacherID}
              readOnly
              className="w-full p-2 mb-4 border rounded-lg bg-gray-100"
            />
          </div>

          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Teacher Name
            </label>

            <input
              type="text"
              name="teacherName"
              value={formData.teacherName}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
              required
            />
          </div>
        </div>

        {/* Gender and Phone */}
        <div className="flex flex-col md:flex-row md:space-x-4">
          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Gender
            </label>

            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Phone
            </label>

            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
            />
          </div>
        </div>

        {/* Email and Category */}
        <div className="flex flex-col md:flex-row md:space-x-4">
          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Email
            </label>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
            />
          </div>

          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Teacher Category
            </label>

            <select
              name="teacherCategory"
              value={formData.teacherCategory}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
              required
            >
              <option value="">Select Category</option>
              <option value="Full Employed Staff">
                Full Employed Staff
              </option>
              <option value="Teacher on Contract">
                Teacher on Contract
              </option>
              <option value="Volunteers Staff">
                Volunteers Staff
              </option>
            </select>
          </div>
        </div>

        {/* Title / Position */}
        <div className="mb-4">
          <label className="block mb-2 font-medium text-sm">
            Title / Position
          </label>

          <div className="flex gap-2">
            <select
              name="position"
              value={formData.position}
              onChange={handleInputChange}
              className="flex-1 p-2 border rounded-lg"
            >
              <option value="">Select Position</option>

              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowPositionModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg font-semibold"
              title="Add Position"
            >
              +
            </button>
          </div>
        </div>

        {/* Salary and Form Master */}
        <div className="flex flex-col md:flex-row md:space-x-4 items-end mb-4">
          <div className="flex-1 w-full">
            <label className="block mb-2 font-medium text-sm">
              Salary
            </label>

            <input
              type="number"
              name="salary"
              placeholder="0.00"
              value={formData.salary}
              onChange={handleInputChange}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="flex-1 w-full flex items-center space-x-3 h-10 mt-4 md:mt-0">
            <input
              type="checkbox"
              id="isFormMaster"
              name="isFormMaster"
              checked={formData.isFormMaster}
              onChange={handleInputChange}
              className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />

            <label
              htmlFor="isFormMaster"
              className="font-medium text-sm select-none"
            >
              Is Form Master?
            </label>
          </div>
        </div>

        {/* Conditional Class Assignment */}
        {formData.isFormMaster && (
          <div className="mb-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <label className="block mb-2 font-medium text-sm text-indigo-900">
              Assigned Class Room
            </label>

            <select
              name="formMasterClass"
              value={formData.formMasterClass}
              onChange={handleInputChange}
              className="w-full p-2 border border-indigo-300 rounded-lg bg-white"
              required={formData.isFormMaster}
            >
              <option value="">Select Class</option>

              {SCHOOL_CLASSES.map((schoolClass) => (
                <option key={schoolClass} value={schoolClass}>
                  {schoolClass}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Address */}
        <div>
          <label className="block mb-2 font-medium text-sm">
            Address
          </label>

          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            className="w-full p-2 mb-4 border rounded-lg"
          />
        </div>

        {/* Registration Date, Registered By and Salary */}
        <div className="flex flex-col md:flex-row md:space-x-4">
          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Registration Date
            </label>

            <input
              type="date"
              name="registrationDate"
              value={formData.registrationDate}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
            />
          </div>

          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Registered By
            </label>

            <input
              type="text"
              name="registeredBy"
              value={formData.registeredBy}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
              placeholder="Enter Staff ID"
            />
          </div>

          <div className="flex-1">
            <label className="block mb-2 font-medium text-sm">
              Salary{" "}
              <span className="text-gray-400">(Optional)</span>
            </label>

            <input
              type="number"
              name="salary"
              value={formData.salary}
              onChange={handleInputChange}
              className="w-full p-2 mb-4 border rounded-lg"
              placeholder="Enter salary"
              min="0"
            />
          </div>
        </div>

        {/* Salary & Attendance Deduction Rules */}
        <div className="border-t border-gray-200 pt-4 mt-2 mb-4">
          <h3 className="text-sm font-bold text-gray-700 mb-4">
            Salary & Attendance Deduction Rules
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Academic Start Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Academic Start Date
              </label>

              <input
                type="date"
                name="academicStartDate"
                value={formData.academicStartDate}
                onChange={handleInputChange}
                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50"
              />

              <p className="text-[10px] text-gray-400 mt-1">
                Attendance deductions will only be calculated from this date.
              </p>
            </div>

            {/* Late Deduction */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Late Deduction Per Day
              </label>

              <input
                type="number"
                name="lateCostPerDay"
                min="0"
                value={formData.lateCostPerDay}
                onChange={handleInputChange}
                placeholder="e.g. 20"
                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50"
              />

              <p className="text-[10px] text-gray-400 mt-1">
                Amount deducted from salary for each late day.
              </p>
            </div>

            {/* Absent Deduction */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Absent Deduction Per Day
              </label>

              <input
                type="number"
                name="absentCostPerDay"
                min="0"
                value={formData.absentCostPerDay}
                onChange={handleInputChange}
                placeholder="e.g. 50"
                className="w-full p-2.5 border rounded-xl text-sm bg-gray-50"
              />

              <p className="text-[10px] text-gray-400 mt-1">
                Amount deducted from salary for each absent day.
              </p>
            </div>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="flex flex-col items-center mb-4 border-t pt-4">
          <label className="mb-2 font-medium text-sm">
            Teacher Photo
          </label>

          <div className="border-4 border-dashed w-36 h-48 flex items-center justify-center bg-white/30 mb-2">
            {formData.userPhoto ? (
              <img
                src={formData.userPhoto}
                alt="Teacher"
                className="w-full h-full object-cover"
              />
            ) : (
              "2-inch Photo"
            )}
          </div>

          <CloudinaryImageUploader
            onUploadSuccess={handleUploadSuccess}
            onUploadStart={() => {
              setIsUploading(true);
              setUploadProgress(0);
            }}
            onUploadProgress={setUploadProgress}
            onUploadComplete={() => setIsUploading(false)}
          />

          <button
            type="button"
            onClick={() => setShowCamera(true)}
            className="w-full sm:w-auto bg-green-600 text-white py-2 px-6 rounded-md text-sm font-semibold mt-2"
            disabled={isUploading}
          >
            Use Camera
          </button>

          {isUploading && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-indigo-500 h-2 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {isSubmitting
            ? "Submitting..."
            : formData.id
              ? "Update Teacher"
              : "Submit"}
        </button>
      </form>

      {/* Camera Modal */}
      {showCamera && (
        <CameraCapture
          setPhoto={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          initialFacingMode="user"
        />
      )}

      {/* Add Position Modal */}
      {showPositionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              Add Position
            </h2>

            <input
              type="text"
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
              placeholder="Enter position"
              className="w-full p-3 border rounded-lg mb-4"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPositionModal(false);
                  setNewPosition("");
                }}
                className="px-4 py-2 bg-gray-300 rounded-lg"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleAddPosition}
                className="px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                Add Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-full lg:max-w-5xl">
        <h2 className="text-2xl font-bold text-center mb-4">
          Registered Teachers ({filteredTeachers.length} of{" "}
          {teachers.length})
        </h2>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by Teacher Name or ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  ID
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Category
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Position
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Form Master
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Salary
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Photo
                </th>

                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {teacher.teacherID}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teacher.teacherName}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {teacher.teacherCategory || "N/A"}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {teacher.position || "N/A"}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {teacher.isFormMaster
                      ? `Yes (${teacher.formMasterClass})`
                      : "No"}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {teacher.salary
                      ? Number(teacher.salary).toLocaleString()
                      : "0"}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teacher.userPhotoUrl && (
                      <img
                        src={teacher.userPhotoUrl}
                        alt={teacher.teacherName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    )}
                  </td>

                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => handleUpdate(teacher)}
                      className="text-indigo-600 hover:text-indigo-900 mr-2"
                    >
                      Update
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(teacher.id, teacher.teacherName)
                      }
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {filteredTeachers.length === 0 && (
                <tr>
                  <td
                    colSpan="8"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No teachers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherRegistration;