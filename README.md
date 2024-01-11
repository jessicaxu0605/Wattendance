
# Wattendance
#### [Wattendance Live Demo 🔗](http://wattendance.s3-website.us-east-2.amazonaws.com/)
Wattendance is a full-stack web application that utilizes facial recognition to automatically record lecture attendence for students in real time. 

<img width="723" alt="Wattendance Landing Page" src="https://github.com/jessicaxu0605/wattendance/assets/91295485/4c741547-7557-4b2f-86b5-e3ff480755a9">

## Components

#### Backend:
**Technologies Used: Node.js, MySQL, AWS (EC2, RDS)**

I designed and implemented a scalable MySQL database to store user accounts, course enrollments, course schedules, and attendance records.

I developed a RESTful API using the Express.js framework to handle requests fom the frontend and facial recognition system to the MySQL database. The API processes real-time requests from the facial recognition system to record students as "present" or "late", and Cron scheduled requests to automatically log absences upon the end of a lecture.

I implemented a user authentication system, employing bcrypt encryption to protect sensitive data and JSON web tokens for efficient and secure user session management. 


#### Frontend:
**Technologies Used: React.js, Material UI, Fetch API, AWS (S3)**

I integrated the frontend with the backend using Fetch API to send requests for data and user authentication.

I co-designed and developed the user interface using Material UI compenents for React.js, including a user profile to display a student's attendance data, a dashboard to display cohort-wide data anonymously, and an interactive survey to record student's performance in their courses.

#### Facial Recognition:
**Technologies Used: Raspberry Pi, OpenCV**

The facial recognition model was developed using Open CV and runs on a Raspberry Pi embedded system. Upon recognizing a student from a live feed, the system sends a request to the API to update the student's attendance record in real time.
