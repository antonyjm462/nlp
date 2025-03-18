import os
import json
import requests
import ffmpeg
import cv2

# Folder containing JSON files
json_folder = 'json_output'
# Folder to save screenshots
screenshot_folder = 'screenshots'

# Duration to download (in seconds)
download_duration = 120  # 2 minutes

# Create the folder to save screenshots if it doesn't exist
if not os.path.exists(screenshot_folder):
    os.makedirs(screenshot_folder)

# Loop through all JSON files in the folder
for json_file in os.listdir(json_folder):
    if json_file.endswith('.json'):
        # Get the full path to the JSON file
        json_path = os.path.join(json_folder, json_file)

        # Load the JSON data
        with open(json_path, 'r') as f:
            data = json.load(f)

        # Extract the video_id and video_url from the JSON
        video_id = data.get('video_id')
        video_url = data.get('video_url')

        if video_url:
            # Print the video_id and video_url (optional)
            print(f"Processing video_id: {video_id}, video_url: {video_url}")

            # Download the first 'download_duration' seconds of the video using ffmpeg
            video_path = f"{video_id}_partial.mp4"
            try:
                ffmpeg.input(video_url, ss=0, t=download_duration).output(video_path).run()
                
                # Open the video using OpenCV
                cap = cv2.VideoCapture(video_path)
                
                # Read the first frame of the video
                ret, frame = cap.read()

                if ret:
                    # Save the first frame as an image in the screenshots folder
                    screenshot_filename = os.path.join(screenshot_folder, f"{video_id}.jpeg")
                    cv2.imwrite(screenshot_filename, frame)
                    print(f"Screenshot saved for video_id: {video_id} as {screenshot_filename}")
                else:
                    print(f"Error reading video {video_id}")

                # Release the video capture object
                cap.release()
                
                # Delete the partial video file to save space
                os.remove(video_path)
                print(f"Deleted partial video file: {video_path}")

            except Exception as e:
                print(f"Error downloading or processing video {video_id}: {e}")
