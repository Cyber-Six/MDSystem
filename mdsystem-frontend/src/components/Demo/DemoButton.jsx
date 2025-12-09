import React from 'react';
import './DemoButton.css';

const DemoButton = ({ children, ...props }) => (
  <button className="demo-btn" {...props}>{children}</button>
);

export default DemoButton;
