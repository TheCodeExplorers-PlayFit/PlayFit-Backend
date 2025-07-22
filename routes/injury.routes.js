const express = require('express');
const router = express.Router();
const injuryController = require('../controllers/injury.controller');
const multer = require('multer');
router.post('/', injuryController.createInjury);

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'application/pdf'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and PDF files are allowed'), false);
    }
  }
});

// Regular injury creation without files
router.post('/', injuryController.createInjury);

// Create injury with files
router.post('/upload', upload.array('files', 5), injuryController.createInjuryWithFiles);

// Get all injuries
router.get('/', injuryController.getInjuries);

// Get all injuries by player ID
router.get('/player/:playerId', injuryController.getInjuriesByPlayerId);

// Get specific injury
router.get('/:id', injuryController.getInjuryById);





module.exports = router;
