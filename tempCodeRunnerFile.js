
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
});

// Error handling middleware
app.use((error, req, res, next) => {