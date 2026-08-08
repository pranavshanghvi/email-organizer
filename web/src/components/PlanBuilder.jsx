import React, { useState } from 'react';
import './PlanBuilder.css';

export default function PlanBuilder({ onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    sender: '',
    action: 'delete', // delete, folder, archive
    folderName: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sender) {
      alert('Please fill in all required fields');
      return;
    }
    onCreate(formData);
    setFormData({ name: '', sender: '', action: 'delete', folderName: '' });
  };

  return (
    <div className="plan-builder">
      <h2>Create New Cleanup Plan</h2>
      <form onSubmit={handleSubmit} className="builder-form">
        <div className="form-group">
          <label htmlFor="name">Plan Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Cleanup USPS emails"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="sender">Sender Email *</label>
          <input
            type="email"
            id="sender"
            name="sender"
            value={formData.sender}
            onChange={handleChange}
            placeholder="e.g., noreply@example.com"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="action">Action *</label>
          <select
            id="action"
            name="action"
            value={formData.action}
            onChange={handleChange}
          >
            <option value="delete">Delete from Gmail & Obsidian</option>
            <option value="folder">Move to Folder</option>
            <option value="archive">Archive (keep in Gmail)</option>
          </select>
        </div>

        {formData.action === 'folder' && (
          <div className="form-group">
            <label htmlFor="folderName">Folder Name</label>
            <input
              type="text"
              id="folderName"
              name="folderName"
              value={formData.folderName}
              onChange={handleChange}
              placeholder="e.g., USPS Informed Delivery"
            />
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="submit-btn">Create Plan</button>
        </div>
      </form>
    </div>
  );
}
