pipeline {
    agent any

    tools {
        // This must match the name you gave in Manage Jenkins -> Tools
        nodejs 'node24'
    }

    stages {
        stage('Checkout') {
            steps {
                // Jenkins will automatically pull code from the branch you specify later
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing packages...'
                sh 'npm install'
            }
        }

        stage('Lint & Type Check') {
            steps {
                echo 'Skipping lint check...'
            }
        }

        stage('Build Next.js App') {
            steps {
                echo 'Building the project...'
                sh 'npm run build'
            }
        }

        stage('Deploy with PM2') {
            steps {
                echo 'Starting the application...'
                // '|| true' ensures the build doesn't fail if the app isn't already running
                sh 'pm2 delete nextjs-app || true'
                sh 'pm2 start npm --name "nextjs-app" -- start'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed. Check the logs.'
        }
    }
}