// src/utils/DataChannelManager.js

/**
 * Manages WebRTC data channels for sending/receiving reactions and messages
 */
export class DataChannelManager {
  constructor() {
    this.dataChannels = new Map(); // Map<peerId, RTCDataChannel>
    this.onMessage = null; // Callback for incoming messages
  }

  /**
   * Create a data channel for a peer connection
   */
  createDataChannel(peerId, peerConnection) {
    try {
      const dataChannel = peerConnection.createDataChannel('reactions', {
        ordered: true,
      });

      this.setupDataChannelHandlers(peerId, dataChannel);
      this.dataChannels.set(peerId, dataChannel);

      console.log(`Data channel created for peer: ${peerId}`);
      return dataChannel;
    } catch (error) {
      console.error(`Failed to create data channel for ${peerId}:`, error);
      return null;
    }
  }

  /**
   * Handle incoming data channel
   */
  handleDataChannel(peerId, dataChannel) {
    this.setupDataChannelHandlers(peerId, dataChannel);
    this.dataChannels.set(peerId, dataChannel);
    console.log(`Data channel received from peer: ${peerId}`);
  }

  /**
   * Setup event handlers for a data channel
   */
  setupDataChannelHandlers(peerId, dataChannel) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      this.dataChannels.delete(peerId);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`Received message from ${peerId}:`, data);
        
        if (this.onMessage) {
          this.onMessage({ ...data, peerId });
        }
      } catch (error) {
        console.error(`Failed to parse message from ${peerId}:`, error);
      }
    };
  }

  /**
   * Send data to a specific peer
   */
  sendToPeer(peerId, data) {
    const channel = this.dataChannels.get(peerId);
    
    if (!channel || channel.readyState !== 'open') {
      console.warn(`Cannot send to ${peerId}: channel not ready`);
      return false;
    }

    try {
      channel.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Failed to send to ${peerId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast data to all connected peers
   */
  broadcast(data) {
    let successCount = 0;
    
    this.dataChannels.forEach((channel, peerId) => {
      if (this.sendToPeer(peerId, data)) {
        successCount++;
      }
    });

    console.log(`Broadcasted to ${successCount}/${this.dataChannels.size} peers`);
    return successCount;
  }

  /**
   * Remove data channel for a peer
   */
  removeChannel(peerId) {
    const channel = this.dataChannels.get(peerId);
    
    if (channel) {
      try {
        channel.close();
      } catch (error) {
        console.error(`Error closing channel for ${peerId}:`, error);
      }
      
      this.dataChannels.delete(peerId);
      console.log(`Data channel removed for ${peerId}`);
    }
  }

  /**
   * Close all data channels
   */
  closeAll() {
    this.dataChannels.forEach((channel, peerId) => {
      try {
        channel.close();
      } catch (error) {
        console.error(`Error closing channel for ${peerId}:`, error);
      }
    });
    
    this.dataChannels.clear();
    console.log('All data channels closed');
  }

  /**
   * Get number of active channels
   */
  getActiveChannelCount() {
    return Array.from(this.dataChannels.values())
      .filter(channel => channel.readyState === 'open')
      .length;
  }
}
