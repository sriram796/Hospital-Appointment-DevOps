pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out Hospital Appointment source code'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Run Tests') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t hospital-appointment-devops:latest .'
            }
        }

        stage('Verify Docker Image') {
            steps {
                sh 'docker images hospital-appointment-devops'
            }
        }
    }

    post {
        success {
            echo 'Hospital Appointment CI/CD Pipeline Successful'
        }

        failure {
            echo 'Hospital Appointment CI/CD Pipeline Failed'
        }
    }
}