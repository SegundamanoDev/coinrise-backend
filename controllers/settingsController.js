const Setting = require("../models/Setting");

// @desc Get current settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch settings." });
  }
};

// @desc Update global settings (admin only)
exports.updateSettings = async (req, res) => {
  const { maintenanceMode, walletAddress } = req.body;

  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = new Setting({ maintenanceMode, walletAddress });
    } else {
      if (maintenanceMode !== undefined)
        settings.maintenanceMode = maintenanceMode;
      if (walletAddress !== undefined) settings.walletAddress = walletAddress;
    }

    await settings.save();
    res.json({ message: "Settings updated successfully", settings });
  } catch (err) {
    res.status(500).json({ message: "Failed to update settings." });
  }
};
