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
                script {
                    // This gets the path to the node24 tool we configured in Jenkins
                    def nodeHome = tool name: 'node24', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
                    
                    // Add the Node bin folder to the PATH for this specific execution
                    withEnv(["PATH+NODE=${nodeHome}/bin"]) {
                        echo "Deploying using Node at ${nodeHome}"
                        
                        // Ensure PM2 is installed inside the tool path
                        sh 'npm install -g pm2'
                        
                        // Clean up and start
                        sh 'pm2 delete nextjs-app || true'
                        
                        // -H 0.0.0.0 is critical for Docker networking
                        sh 'pm2 start npm --name "nextjs-app" -- start -- -p 3000 -H 0.0.0.0'
                        
                        // Wait a few seconds to let it boot
                        sh 'sleep 5'
                        
                        // Check if it's actually listening
                        sh 'curl -I http://localhost:3000 || (pm2 logs nextjs-app --lines 20 && exit 1)'
                    }
                }
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